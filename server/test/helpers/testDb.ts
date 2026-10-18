import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { Client } = pg;

/** Тести працюють з окремою базою `<назва>_test`, щоб не зачепити дані розробки. */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

/** Створює тестову БД (якщо її немає), скидає схему й накочує міграції. Повертає URL. */
export async function resetTestDatabase(): Promise<string> {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rows.length === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  await applyMigrations(url, { reset: true });
  return url;
}

const migrationsDir = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));

/**
 * Застосовує prisma/migrations/*\/migration.sql до тестової бази (без запуску Prisma CLI).
 * Журнал застосованих міграцій — власна таблиця `_test_migrations`; повертає імена нових міграцій.
 */
export async function applyMigrations(
  connectionString: string,
  options: { reset?: boolean } = {},
): Promise<string[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (options.reset) {
      await client.query('DROP SCHEMA IF EXISTS public CASCADE');
      await client.query('CREATE SCHEMA public');
    }
    await client.query(
      'CREATE TABLE IF NOT EXISTS _test_migrations (name text PRIMARY KEY)',
    );
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM _test_migrations')).rows.map(
        (r) => r.name,
      ),
    );
    const applied: string[] = [];
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of dirs) {
      if (done.has(name)) continue;
      const sql = readFileSync(`${migrationsDir}${name}/migration.sql`, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _test_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      applied.push(name);
    }
    return applied;
  } finally {
    await client.end();
  }
}
