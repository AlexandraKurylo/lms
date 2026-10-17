import { Router } from 'express';
import type { Response } from 'express';
import { parseWith } from '../../shared/validate.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type TokenService,
} from '../../shared/auth/tokens.js';
import type { AuthGuards } from './auth.guards.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';

export interface AuthRouterDeps {
  service: AuthService;
  tokens: TokenService;
  guards: Pick<AuthGuards, 'requireAuth'>;
  cookieSecure: boolean;
}

export function authRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  // httpOnly: скрипт сторінки не бачить токен (захист від викрадення через XSS);
  // sameSite=lax: браузер не додає cookie до міжсайтових POST-запитів (захист від CSRF).
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: deps.cookieSecure,
    path: '/',
  };

  async function startSession(res: Response, user: AuthUser): Promise<void> {
    const token = await deps.tokens.sign({ userId: user.id, role: user.role });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });
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

  router.post('/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/auth/me', deps.guards.requireAuth, (req, res) => {
    res.json(req.user);
  });

  return router;
}
