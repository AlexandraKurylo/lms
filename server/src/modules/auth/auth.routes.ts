import { Router } from 'express';
import type { Response } from 'express';
import { DomainError } from '../../shared/errors.js';
import { parseWith } from '../../shared/validate.js';
import {
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  readCookie,
  type TokenService,
} from '../../shared/auth/tokens.js';
import type { AuthGuards } from './auth.guards.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import type { IssuedRefresh, RefreshService } from './refresh.service.js';

export interface AuthRouterDeps {
  service: AuthService;
  refresh: RefreshService;
  tokens: TokenService;
  guards: Pick<AuthGuards, 'requireAuth'>;
  cookieSecure: boolean;
}

export function authRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  // Короткоживучий «доступ». httpOnly: скрипт сторінки не бачить токен (захист від XSS);
  // sameSite=lax: браузер не додає cookie до міжсайтових POST-запитів (захист від CSRF).
  const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: deps.cookieSecure,
    path: '/',
  };
  // Refresh-токен: суворіше. sameSite=strict і path=/api/auth: cookie їде лише на маршрути
  // /api/auth/*, у решту запитів він не потрапляє взагалі.
  const refreshCookie = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: deps.cookieSecure,
    path: '/api/auth',
  };

  async function setSession(res: Response, user: AuthUser, refresh: IssuedRefresh): Promise<void> {
    const access = await deps.tokens.sign({ userId: user.id, role: user.role });
    res.cookie(SESSION_COOKIE, access, { ...sessionCookie, maxAge: SESSION_TTL_SECONDS * 1000 });
    // refresh-токен лише в cookie, у тіло відповіді він НЕ потрапляє
    res.cookie(REFRESH_COOKIE, refresh.token, {
      ...refreshCookie,
      maxAge: REFRESH_TTL_SECONDS * 1000,
    });
  }

  function clearSession(res: Response): void {
    res.clearCookie(SESSION_COOKIE, sessionCookie);
    res.clearCookie(REFRESH_COOKIE, refreshCookie);
  }

  async function startSession(res: Response, user: AuthUser): Promise<void> {
    await setSession(res, user, await deps.refresh.issue(user.id));
  }

  router.post('/auth/register', async (req, res) => {
    const input = parseWith(registerSchema, req.body);
    const user = await deps.service.register(input);
    await startSession(res, user);
    res.status(201).json(user);
  });

  router.post('/auth/login', async (req, res) => {
    const input = parseWith(loginSchema, req.body);
    const user = await deps.service.login(input);
    await startSession(res, user);
    res.json(user);
  });

  router.post('/auth/refresh', async (req, res) => {
    const raw = readCookie(req.headers.cookie, REFRESH_COOKIE);
    if (!raw) throw new DomainError('unauthorized', 'Сесія недійсна. Увійдіть знову');
    try {
      const { user, refresh } = await deps.refresh.rotate(raw);
      await setSession(res, user, refresh);
      res.json(user);
    } catch (err) {
      // невдале оновлення: прибираємо cookie, щоб браузер не слав їх знову
      clearSession(res);
      throw err;
    }
  });

  router.post('/auth/logout', async (req, res) => {
    const raw = readCookie(req.headers.cookie, REFRESH_COOKIE);
    if (raw) await deps.refresh.revokeByToken(raw);
    clearSession(res);
    res.status(204).end();
  });

  router.post('/auth/logout-all', deps.guards.requireAuth, async (req, res) => {
    // requireAuth уже гарантує користувача; перевірка потрібна лише для типів
    if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
    await deps.refresh.revokeAll(req.user.id);
    clearSession(res);
    res.status(204).end();
  });

  router.get('/auth/me', deps.guards.requireAuth, (req, res) => {
    res.json(req.user);
  });

  return router;
}
