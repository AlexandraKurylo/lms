import express from 'express';
import type { Express } from 'express';

/** Фабрика застосунку: тести можуть створювати app без запуску HTTP-сервера. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  return app;
}
