import bcrypt from 'bcryptjs';
import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { createAdminService } from './modules/admin/admin.service.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { createAuthGuards } from './modules/auth/auth.guards.js';
import { createAuthRepo } from './modules/auth/auth.repo.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { createAuthService, type PasswordHasher } from './modules/auth/auth.service.js';
import { createRefreshRepo } from './modules/auth/refresh.repo.js';
import { createRefreshService } from './modules/auth/refresh.service.js';
import { createCatalogRepo } from './modules/catalog/catalog.repo.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { createCatalogService } from './modules/catalog/catalog.service.js';
import { createEnrollmentsService } from './modules/enrollments/enrollments.service.js';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes.js';
import { createTeacherRepo } from './modules/teacher/teacher.repo.js';
import { teacherRouter } from './modules/teacher/teacher.routes.js';
import { createTeacherService } from './modules/teacher/teacher.service.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createTokenService } from './shared/auth/tokens.js';
import type { Db } from './shared/db.js';
import { requestContext } from './shared/http/requestContext.js';
import { errorHandler, notFoundHandler } from './shared/problem.js';
import { createLogger } from './shared/logger.js';

export interface AppDeps {
  logger: Logger;
  checkReady: () => Promise<void>;
  db: Db;
  jwtSecret: string;
  cookieSecure: boolean;
  hasher: PasswordHasher;
}

const bcryptHasher: PasswordHasher = {
  hash: (password) => bcrypt.hash(password, 10),
  compare: (password, hash) => bcrypt.compare(password, hash),
};

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
    const refresh = createRefreshService({
      repo: createRefreshRepo(deps.db),
      users: repo,
      onReuse: ({ familyId, userId }) =>
        logger.warn({ familyId, userId }, 'refresh token reuse detected'),
    });

    app.use('/api', guards.authenticate);
    app.use(
      '/api',
      authRouter({
        service: createAuthService({ repo, hasher }),
        refresh,
        tokens,
        guards,
        cookieSecure: deps.cookieSecure ?? false,
      }),
    );
    app.use(
      '/api',
      catalogRouter({ service: createCatalogService({ repo: createCatalogRepo(deps.db) }) }),
    );
    app.use(
      '/api',
      teacherRouter({
        service: createTeacherService({ repo: createTeacherRepo(deps.db) }),
        guards,
      }),
    );
    app.use(
      '/api',
      adminRouter({ service: createAdminService({ db: deps.db }), guards }),
    );
    app.use(
      '/api',
      enrollmentsRouter({ service: createEnrollmentsService({ db: deps.db }), guards }),
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}