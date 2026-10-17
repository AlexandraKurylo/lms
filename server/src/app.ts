import bcrypt from 'bcryptjs';
import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { createAuthGuards } from './modules/auth/auth.guards.js';
import { createAuthRepo } from './modules/auth/auth.repo.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { createAuthService, type PasswordHasher } from './modules/auth/auth.service.js';
import { createCatalogRepo } from './modules/catalog/catalog.repo.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { createCatalogService } from './modules/catalog/catalog.service.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createTokenService } from './shared/auth/tokens.js';
import type { Queryable } from './shared/db.js';
import { requestContext } from './shared/http/requestContext.js';
import { errorHandler, notFoundHandler } from './shared/problem.js';
import { createLogger } from './shared/logger.js';

export interface AppDeps {
  logger: Logger;
  checkReady: () => Promise<void>;
  /** База даних. Без неї застосунок піднімається лише зі службовими ендпоінтами (/health, /ready). */
  db: Queryable;
  jwtSecret: string;
  cookieSecure: boolean;
  /** Підмінюється у тестах швидшим хешером; за замовчуванням bcrypt із вартістю 10. */
  hasher: PasswordHasher;
}

const bcryptHasher: PasswordHasher = {
  hash: (password) => bcrypt.hash(password, 10),
  compare: (password, hash) => bcrypt.compare(password, hash),
};

/** Фабрика застосунку: залежності передаються ззовні, тож тести створюють app без порту й без БД. */
export function createApp(deps: Partial<AppDeps> = {}): Express {
  const logger = deps.logger ?? createLogger('silent');
  const checkReady = deps.checkReady ?? (async () => {});

  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter({ checkReady }));

  if (deps.db && deps.jwtSecret) {
    const repo = createAuthRepo(deps.db);
    const tokens = createTokenService(deps.jwtSecret);
    const guards = createAuthGuards({ tokens, repo });
    const hasher = deps.hasher ?? bcryptHasher;

    // користувач визначається один раз на запит, до всіх маршрутів
    app.use('/api', guards.authenticate);
    app.use(
      '/api',
      authRouter({
        service: createAuthService({ repo, hasher }),
        tokens,
        guards,
        cookieSecure: deps.cookieSecure ?? false,
      }),
    );
    app.use(
      '/api',
      catalogRouter({ service: createCatalogService({ repo: createCatalogRepo(deps.db) }) }),
    );
  }

  // порядок важливий: спершу маршрути, потім 404, і останнім — обробник помилок
  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}

