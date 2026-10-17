import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { requestStore } from '../logger.js';

const ID_PATTERN = /^[A-Za-z0-9._-]{8,100}$/;

/**
 * Присвоює кожному запиту ідентифікатор, повертає його клієнту в `X-Request-Id`
 * і пише один рядок логу після завершення відповіді.
 * Заголовки й тіло запиту в лог не потрапляють (там можуть бути паролі та токени).
 */
export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && ID_PATTERN.test(incoming) ? incoming : randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      requestStore.run({ requestId }, () => {
        logger[level](
          {
            method: req.method,
            path: req.originalUrl.split('?')[0],
            status: res.statusCode,
            durationMs: Math.round(durationMs * 10) / 10,
          },
          'request completed',
        );
      });
    });

    requestStore.run({ requestId }, next);
  };
}
