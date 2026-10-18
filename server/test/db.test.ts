import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, type PrismaClient } from '../src/shared/db.js';
import { resetTestDatabase } from './helpers/testDb.js';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = createPrisma(await resetTestDatabase());
});
afterAll(async () => {
  await prisma.$disconnect();
});

const topicCount = () => prisma.topic.count();

describe('prisma.$transaction', () => {
  it('фіксує зміни, якщо все пройшло', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.topic.create({ data: { name: 'Збережена' } });
    });
    expect(await topicCount()).toBe(1);
  });

  it('відкочує всі зміни й пробрасує помилку, якщо щось впало', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.topic.create({ data: { name: 'Відкочена' } });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await topicCount()).toBe(1);
  });

  it('повертає значення з callback', async () => {
    const value = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ n: number }[]>`SELECT 41 + 1 AS n`;
      return rows[0]!.n;
    });
    expect(value).toBe(42);
  });
});
