import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { DomainError } from '../../shared/errors.js';
import { SESSION_COOKIE, readCookie, type TokenService } from '../../shared/auth/tokens.js';
import type { AuthRepo } from './auth.repo.js';
import type { Role } from './auth.types.js';

/**
 * `authenticate` лише з'ясовує, хто звертається (cookie → користувач із бази), і НЕ відмовляє.
 * Вимоги до доступу ставлять `requireAuth` / `requireRole` на конкретних маршрутах.
 * Користувача перечитуємо з бази: видалений акаунт або змінена роль діє одразу, а не після закінчення токена.
 */
export function createAuthGuards(deps: { tokens: TokenService; repo: Pick<AuthRepo, 'findById'> }) {
  const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      const claims = await deps.tokens.verify(token);
      if (claims) {
        const user = await deps.repo.findById(claims.userId);
        if (user) req.user = user;
      }
    }
    next();
  };

  const requireAuth: RequestHandler = (req, _res, next) => {
    if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
    next();
  };

  const requireRole = (...roles: Role[]): RequestHandler => {
    return (req, _res, next) => {
      if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
      if (!roles.includes(req.user.role)) {
        throw new DomainError('forbidden', 'Недостатньо прав для цієї дії');
      }
      next();
    };
  };

  return { authenticate, requireAuth, requireRole };
}

export type AuthGuards = ReturnType<typeof createAuthGuards>;
