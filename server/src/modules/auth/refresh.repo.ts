import type { Db } from '../../shared/db.js';

export interface RefreshTokenRow {
  id: number;
  userId: number;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

const select = {
  id: true,
  userId: true,
  familyId: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
} as const;

export function createRefreshRepo(db: Db) {
  return {
    async insert(input: {
      userId: number;
      familyId: string;
      tokenHash: string;
      expiresAt: Date;
    }): Promise<void> {
      await db.refreshToken.create({ data: input });
    },

    async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
      return db.refreshToken.findUnique({ where: { tokenHash }, select });
    },

    /**
     * Позначає токен «обміняним» ЛИШЕ якщо він ще не використаний і не відкликаний.
     * Умова в WHERE робить перевірку й запис одним атомарним запитом: із двох одночасних
     * запитів з тим самим токеном рівно один отримає 1, другий — 0.
     */
    async markUsed(id: number, now: Date): Promise<boolean> {
      const { count } = await db.refreshToken.updateMany({
        where: { id, usedAt: null, revokedAt: null },
        data: { usedAt: now },
      });
      return count === 1;
    },

    /** Відкликає всі токени одного входу («сімейство»). */
    async revokeFamily(familyId: string, now: Date): Promise<void> {
      await db.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: now },
      });
    },

    /** Відкликає всі токени користувача на всіх пристроях. */
    async revokeAllForUser(userId: number, now: Date): Promise<void> {
      await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    },
  };
}

export type RefreshRepo = ReturnType<typeof createRefreshRepo>;
