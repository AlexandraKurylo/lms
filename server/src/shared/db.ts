import pg from 'pg';

const { Pool } = pg;

export type Pool = InstanceType<typeof Pool>;

/** Те, що вміє виконувати запит: і пул, і клієнт транзакції. Репозиторії приймають саме його. */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

/**
 * Виконує `work` в одній транзакції: COMMIT, якщо все пройшло, інакше ROLLBACK і помилка летить далі.
 * Клієнт завжди повертається в пул — навіть коли сам ROLLBACK не вдався.
 */
export async function withTransaction<T>(
  pool: Pool,
  work: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
