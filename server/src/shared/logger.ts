import { AsyncLocalStorage } from 'node:async_hooks';
import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

/** Сховище контексту запиту: тут лежить наскрізний ідентифікатор (correlation id). */
export const requestStore = new AsyncLocalStorage<{ requestId: string }>();

// Поля, значення яких ніколи не потрапляють у лог.
const SECRET_PATHS = [
  'password',
  'passwordHash',
  'token',
  'authorization',
  'cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.authorization',
  '*.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
];

/**
 * Структурований JSON-лог із рівнями. Кожен рядок автоматично отримує `requestId`
 * поточного запиту (через AsyncLocalStorage), навіть якщо лог пишеться глибоко в сервісі.
 */
export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      base: { service: 'lms-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      mixin: () => {
        const requestId = requestStore.getStore()?.requestId;
        return requestId ? { requestId } : {};
      },
      redact: { paths: SECRET_PATHS, censor: '[redacted]' },
    },
    destination,
  );
}
