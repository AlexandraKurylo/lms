import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrisma } from './shared/db.js';
import { createLogger } from './shared/logger.js';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const prisma = createPrisma(config.DATABASE_URL, { log: config.PRISMA_LOG });
// /ready стає 503, якщо база недоступна: оркестратор не шле трафік на інстанс без БД
const app = createApp({
  logger,
  db: prisma,
  jwtSecret: config.JWT_SECRET,
  cookieSecure: config.COOKIE_SECURE,
  checkReady: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
});

const server = app.listen(config.API_PORT, () => {
  logger.info({ port: config.API_PORT, env: config.NODE_ENV }, 'api listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
});
