import pg from 'pg';
import { runMigrations } from '../../src/db/migrate.js';

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

  await runMigrations({ connectionString: url, reset: true });
  return url;
}
