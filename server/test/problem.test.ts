import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError } from '../src/shared/errors.js';
import { requestContext } from '../src/shared/http/requestContext.js';
import { createLogger } from '../src/shared/logger.js';
import { errorHandler, notFoundHandler } from '../src/shared/problem.js';
import { parseWith } from '../src/shared/validate.js';

function buildApp() {
  const logger = createLogger('silent');
  const app = express();
  app.use(requestContext(logger));
  app.use(express.json());
  app.get('/domain', () => {
    throw new DomainError('stream-full', 'На потоці немає місць');
  });
  app.get('/validation', (req) => {
    parseWith(z.object({ page: z.coerce.number().int().min(1) }), req.query, 'query');
  });
  app.get('/boom', async () => {
    throw new Error('connection to db at 10.0.0.5 failed, password=secret');
  });
  app.post('/json', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

describe('problem+json', () => {
  it('доменна помилка має стабільний type, статус і requestId', async () => {
    const res = await request(buildApp()).get('/domain');
    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.type).toBe('https://lms.example/problems/stream-full');
    expect(res.body.detail).toBe('На потоці немає місць');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('помилка валідації містить перелік полів', async () => {
    const res = await request(buildApp()).get('/validation?page=abc');
    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://lms.example/problems/validation');
    expect(res.body.errors[0].path).toBe('query.page');
  });

  it('500 не містить стектрейсу й тексту помилки', async () => {
    const res = await request(buildApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.type).toBe('https://lms.example/problems/internal');
    expect(res.body).not.toHaveProperty('detail');
    expect(res.body).not.toHaveProperty('stack');
    expect(res.text).not.toContain('secret');
    expect(res.text).not.toContain('10.0.0.5');
  });

  it('некоректний JSON → 400 bad-request', async () => {
    const res = await request(buildApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://lms.example/problems/bad-request');
  });

  it('завеликий JSON → 413', async () => {
    const res = await request(buildApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.type).toBe('https://lms.example/problems/payload-too-large');
  });

  it('невідомий маршрут → 404 у форматі problem+json', async () => {
    const res = await request(buildApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.type).toBe('https://lms.example/problems/not-found');
  });
});
