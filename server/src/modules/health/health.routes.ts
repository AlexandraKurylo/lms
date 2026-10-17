import { Router } from 'express';

export interface HealthDeps {
  /** Перевіряє залежності (база даних). Кидає помилку, якщо сервіс не готовий. */
  checkReady: () => Promise<void>;
}

export function healthRouter(deps: HealthDeps): Router {
  const router = Router();

  // liveness: процес живий
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // readiness: процес може обслуговувати запити (БД доступна)
  router.get('/ready', async (_req, res) => {
    try {
      await deps.checkReady();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
