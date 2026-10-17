import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('createApp', () => {
  it('створює Express-застосунок без запуску сервера', () => {
    const app = createApp();
    expect(typeof app.use).toBe('function');
    expect(app.get('x-powered-by')).toBe(false);
  });
});
