import { describe, expect, it } from 'vitest';
import { createLogger, requestStore } from '../src/shared/logger.js';

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = { write: (chunk: string) => void lines.push(JSON.parse(chunk)) };
  return { logger: createLogger('info', stream), lines };
}

describe('logger', () => {
  it('пише JSON із рівнем і сервісом', () => {
    const { logger, lines } = captureLogger();
    logger.info({ a: 1 }, 'hello');
    expect(lines[0]).toMatchObject({ level: 'info', service: 'lms-api', msg: 'hello', a: 1 });
  });

  it('додає requestId у кожен рядок усередині контексту запиту', () => {
    const { logger, lines } = captureLogger();
    requestStore.run({ requestId: 'req-12345678' }, () => logger.info('inside'));
    logger.info('outside');
    expect(lines[0]).toMatchObject({ requestId: 'req-12345678' });
    expect(lines[1]).not.toHaveProperty('requestId');
  });

  it('приховує секрети', () => {
    const { logger, lines } = captureLogger();
    logger.info({ password: 'hunter2', user: { token: 'abc' }, headers: { cookie: 'sid=1' } }, 'x');
    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('abc');
    expect(text).not.toContain('sid=1');
    expect(text).toContain('[redacted]');
  });
});
