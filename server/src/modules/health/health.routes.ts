import { Router } from 'express';
import { DomainError } from '../../shared/errors.js';

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
    } catch {
      throw new DomainError('service-unavailable', 'Залежність недоступна');
    }
    res.json({ status: 'ready' });
  });

  return router;
}
