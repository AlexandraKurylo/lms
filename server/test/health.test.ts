import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  it('GET /api/health повертає ok і заголовок X-Request-Id', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('повертає клієнтський X-Request-Id, якщо він коректний', async () => {
    const res = await request(createApp())
      .get('/api/health')
      .set('X-Request-Id', 'client-id-12345');
    expect(res.headers['x-request-id']).toBe('client-id-12345');
  });

  it('замінює підозрілий X-Request-Id на згенерований', async () => {
    const res = await request(createApp()).get('/api/health').set('X-Request-Id', 'bad id!');
    expect(res.headers['x-request-id']).not.toBe('bad id!');
  });

  it('GET /api/ready повертає 503, коли залежність недоступна', async () => {
    const app = createApp({
      checkReady: async () => {
        throw new Error('db down');
      },
    });
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(503);
  });

  it('GET /api/ready повертає ready, коли все гаразд', async () => {
    const res = await request(createApp()).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });
});
