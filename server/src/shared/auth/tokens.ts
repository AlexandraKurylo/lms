import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '../../modules/auth/auth.types.js';

export const SESSION_COOKIE = 'lms_session';
/** Короткий «доступ»: навіть якщо токен вкрадуть, він живе лише 15 хвилин. */
export const SESSION_TTL_SECONDS = 15 * 60;

export const REFRESH_COOKIE = 'lms_refresh';
export const REFRESH_TTL_DAYS = 7;
export const REFRESH_TTL_SECONDS = REFRESH_TTL_DAYS * 24 * 60 * 60;

/** Refresh-токен — не JWT, а 32 випадкові байти: серверу однаково доведеться шукати його в базі. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * У базі зберігаємо sha256 токена. Для паролів швидкий хеш поганий, а для токена нормальний:
 * це 256 випадкових біт, їх неможливо перебрати, тож повільний хеш тут нічого б не додав.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionClaims {
  userId: number;
  role: Role;
}

export function createTokenService(secret: string) {
  const key = new TextEncoder().encode(secret);

  return {
    async sign(claims: SessionClaims): Promise<string> {
      return new SignJWT({ role: claims.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(String(claims.userId))
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .sign(key);
    },

    /** Повертає claims або null: прострочений, підроблений чи зіпсований токен — це «не увійшов». */
    async verify(token: string): Promise<SessionClaims | null> {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        const userId = Number(payload.sub);
        const role = payload.role;
        if (!Number.isInteger(userId) || typeof role !== 'string') return null;
        return { userId, role: role as Role };
      } catch {
        return null;
      }
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;

/** Достає значення cookie з заголовка `Cookie` без додаткових залежностей. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
