import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;

// довільне число-ідентифікатор для advisory lock: два процеси не мігрують одночасно
const MIGRATION_LOCK_ID = 727_274;

export interface MigrateOptions {
  connectionString: string;
  /** Видалити всю схему й накотити міграції з нуля (лише для розробки й тестів). */
  reset?: boolean;
  /** Каталог із файлами NNNN_назва.sql. */
  dir?: string;
  log?: (message: string) => void;
}

const defaultDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

/** Застосовує міграції, яких ще немає в schema_migrations. Повертає імена застосованих. */
export async function runMigrations(options: MigrateOptions): Promise<string[]> {
  const dir = options.dir ?? defaultDir;
  const log = options.log ?? (() => {});
  const client = new Client({ connectionString: options.connectionString });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

    if (options.reset) {
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      await client.query('CREATE SCHEMA public');
      log('schema reset');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const done = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const alreadyApplied = new Set(done.rows.map((row) => row.name));

    const files = readdirSync(dir)
      .filter((file) => /^\d{4}_.+\.sql$/.test(file))
      .sort();

    const applied: string[] = [];
    for (const file of files) {
      if (alreadyApplied.has(file)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      // кожна міграція виконується в окремій транзакції: або вся, або нічого
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Міграція ${file} не застосована: ${(err as Error).message}`, {
          cause: err,
        });
      }
      applied.push(file);
      log(`applied ${file}`);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end();
  }
}

// Запуск із командного рядка: `npm run db:migrate` або `npm run db:reset`
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('DATABASE_URL не задано\n');
    process.exit(1);
  }
  const reset = process.argv.includes('--reset');
  if (reset && process.env.NODE_ENV === 'production') {
    process.stderr.write('--reset заборонено в production\n');
    process.exit(1);
  }
  runMigrations({
    connectionString: url,
    reset,
    log: (m) => process.stdout.write(`[migrate] ${m}\n`),
  })
    .then((applied) => {
      process.stdout.write(`[migrate] done, applied: ${applied.length}\n`);
    })
    .catch((err: unknown) => {
      process.stderr.write(`[migrate] ${(err as Error).message}\n`);
      process.exit(1);
    });
}
