import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '../../modules/auth/auth.types.js';

export const SESSION_COOKIE = 'lms_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

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
