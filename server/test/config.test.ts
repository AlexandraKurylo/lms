import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const validEnv = {
  DATABASE_URL: 'postgres://lms:pass@localhost:5432/lms',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('застосовує значення за замовчуванням', () => {
    const config = loadConfig(validEnv);
    expect(config.API_PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.COOKIE_SECURE).toBe(false);
  });

  it('перетворює рядки на числа й булеві значення', () => {
    const config = loadConfig({ ...validEnv, API_PORT: '8080', COOKIE_SECURE: 'true' });
    expect(config.API_PORT).toBe(8080);
    expect(config.COOKIE_SECURE).toBe(true);
  });

  it('відхиляє занадто короткий JWT_SECRET', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('вимагає DATABASE_URL', () => {
    expect(() => loadConfig({ JWT_SECRET: validEnv.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
});
