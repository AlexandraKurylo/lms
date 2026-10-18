import { randomUUID } from 'node:crypto';
import { DomainError } from '../../shared/errors.js';
import {
  REFRESH_TTL_SECONDS,
  hashRefreshToken,
  newRefreshToken,
} from '../../shared/auth/tokens.js';
import type { AuthRepo } from './auth.repo.js';
import type { AuthUser } from './auth.types.js';
import type { RefreshRepo } from './refresh.repo.js';

export interface IssuedRefresh {
  /** Сирий токен: його бачить лише клієнт (у cookie). У базі лежить тільки хеш. */
  token: string;
  expiresAt: Date;
}

export interface RefreshDeps {
  repo: RefreshRepo;
  users: Pick<AuthRepo, 'findById'>;
  /** Викликається, коли виявлено повторне використання токена (ознака крадіжки). */
  onReuse?: (info: { familyId: string; userId: number }) => void;
  now?: () => Date;
}

// Одна й та сама відповідь на будь-яку проблему з токеном: протермінований, підроблений,
// уже використаний — клієнту однаково. Деталі допомагають лише тому, хто підбирає токен.
const invalid = () => new DomainError('unauthorized', 'Сесія недійсна. Увійдіть знову');

export function createRefreshService(deps: RefreshDeps) {
  const { repo, users } = deps;
  const now = deps.now ?? (() => new Date());

  async function issue(userId: number, familyId: string = randomUUID()): Promise<IssuedRefresh> {
    const token = newRefreshToken();
    const expiresAt = new Date(now().getTime() + REFRESH_TTL_SECONDS * 1000);
    await repo.insert({ userId, familyId, tokenHash: hashRefreshToken(token), expiresAt });
    return { token, expiresAt };
  }

  return {
    /** Новий вхід = нове «сімейство» токенів. */
    issue,

    /**
     * Ротація: кожен refresh-токен дійсний рівно один раз. Обмінюємо його на нову пару.
     * Якщо ж прийшов токен, який уже обміняли, — або його вкрали, або це гонка двох запитів.
     * Невідомо, хто з двох власник, тому відкликаємо все сімейство: усі входять заново.
     */
    async rotate(raw: string): Promise<{ user: AuthUser; refresh: IssuedRefresh }> {
      const found = await repo.findByHash(hashRefreshToken(raw));
      if (!found || found.revokedAt || found.expiresAt <= now()) throw invalid();

      if (found.usedAt) {
        await repo.revokeFamily(found.familyId, now());
        deps.onReuse?.({ familyId: found.familyId, userId: found.userId });
        throw invalid();
      }

      // атомарно: із двох одночасних запитів з тим самим токеном успіх лише в одного
      if (!(await repo.markUsed(found.id, now()))) {
        await repo.revokeFamily(found.familyId, now());
        deps.onReuse?.({ familyId: found.familyId, userId: found.userId });
        throw invalid();
      }

      const user = await users.findById(found.userId);
      if (!user) {
        await repo.revokeFamily(found.familyId, now());
        throw invalid();
      }
      return { user, refresh: await issue(found.userId, found.familyId) };
    },

    /** Вихід з одного пристрою: відкликаємо сімейство токенів, до якого належить цей. */
    async revokeByToken(raw: string): Promise<void> {
      const found = await repo.findByHash(hashRefreshToken(raw));
      if (found) await repo.revokeFamily(found.familyId, now());
    },

    /** Вихід з усіх пристроїв. */
    async revokeAll(userId: number): Promise<void> {
      await repo.revokeAllForUser(userId, now());
    },
  };
}

export type RefreshService = ReturnType<typeof createRefreshService>;
