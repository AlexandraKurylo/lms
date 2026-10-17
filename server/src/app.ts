import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { healthRouter } from './modules/health/health.routes.js';
import { requestContext } from './shared/http/requestContext.js';
import { createLogger } from './shared/logger.js';

export interface AppDeps {
  logger: Logger;
  checkReady: () => Promise<void>;
}

/** Фабрика застосунку: залежності передаються ззовні, тож тести створюють app без порту й без БД. */
export function createApp(deps: Partial<AppDeps> = {}): Express {
  const logger = deps.logger ?? createLogger('silent');
  const checkReady = deps.checkReady ?? (async () => {});

  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter({ checkReady }));

  return app;
}
