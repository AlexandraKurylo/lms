import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withTransaction, type Pool } from '../src/shared/db.js';
import { resetTestDatabase } from './helpers/testDb.js';

let pool: Pool;

beforeAll(async () => {
  pool = createPool(await resetTestDatabase());
});
afterAll(async () => {
  await pool.end();
});

async function topicCount(): Promise<number> {
  const r = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM topics');
  return r.rows[0]!.n;
}

describe('withTransaction', () => {
  it('фіксує зміни, якщо все пройшло', async () => {
    await withTransaction(pool, async (tx) => {
      await tx.query(`INSERT INTO topics (name) VALUES ('Збережена')`);
    });
    expect(await topicCount()).toBe(1);
  });

  it('відкочує всі зміни й пробрасує помилку, якщо щось впало', async () => {
    await expect(
      withTransaction(pool, async (tx) => {
        await tx.query(`INSERT INTO topics (name) VALUES ('Відкочена')`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await topicCount()).toBe(1);
  });

  it('повертає значення з callback', async () => {
    const value = await withTransaction(pool, async (tx) => {
      const r = await tx.query<{ n: number }>('SELECT 41 + 1 AS n');
      return r.rows[0]!.n;
    });
    expect(value).toBe(42);
  });
});
