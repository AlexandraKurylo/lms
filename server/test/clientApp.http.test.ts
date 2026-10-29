import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('роздача клієнта з API', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'lms-client-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>LMS</title>');
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('віддає index.html на головній і на адресах клієнтського маршрутизатора', async () => {
    const app = createApp({ staticDir: dir });
    for (const path of ['/', '/courses/12', '/teacher/streams/3']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>LMS</title>');
    }
  });

  it('віддає файли з assets із довгим кешем', async () => {
    const res = await request(createApp({ staticDir: dir })).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('неіснуючий файл assets і неіснуючий маршрут API дають 404 problem+json', async () => {
    const app = createApp({ staticDir: dir });
    for (const path of ['/assets/missing.js', '/api/nope']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('не заважає API', async () => {
    const res = await request(createApp({ staticDir: dir })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('без staticDir клієнт не віддається', async () => {
    const res = await request(createApp()).get('/courses');
    expect(res.status).toBe(404);
  });
});
