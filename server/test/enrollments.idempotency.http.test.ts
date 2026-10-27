import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherId: number;
let student: string;
let student2: string;

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});
beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  teacherId = await kit.createUser('t@example.com', 'teacher');
  await kit.createUser('s1@example.com', 'student');
  await kit.createUser('s2@example.com', 'student');
  student = await kit.loginAs('s1@example.com');
  student2 = await kit.loginAs('s2@example.com');
});

const enroll = (streamId: number, cookie: string, key?: string) => {
  const req = request(kit.app).post(`/api/streams/${streamId}/enrollments`).set('Cookie', cookie);
  return key === undefined ? req : req.set('Idempotency-Key', key);
};
const seats = async (streamId: number) =>
  (
    await kit.pool.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE stream_id = $1 AND status IN ('active','completed')`,
      [streamId],
    )
  ).rows[0].n as number;
const savedKeys = async () =>
  (await kit.pool.query('SELECT count(*)::int AS n FROM idempotency_keys')).rows[0].n as number;

describe('Idempotency-Key при записі на потік', () => {
  it('повтор із тим самим ключем повертає ту саму відповідь і не створює другий запис', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    const first = await enroll(stream, student, 'key-1');
    const second = await enroll(stream, student, 'key-1');
    expect(first.status).toBe(201);
    expect(first.headers['idempotency-replayed']).toBe(undefined);
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await seats(stream)).toBe(1);
    expect(await savedKeys()).toBe(1);
  });

  it('без заголовка повторний запис, як і раніше, дає 409 already-enrolled', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    expect((await enroll(stream, student)).status).toBe(201);
    const res = await enroll(stream, student);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/already-enrolled$/);
    expect(await savedKeys()).toBe(0);
  });

  it('той самий ключ з іншим запитом → 422 idempotency-key-reuse', async () => {
    const course = await kit.createCourse(teacherId);
    const a = await kit.createStream(course, 5);
    const b = await kit.createStream(course, 5);
    expect((await enroll(a, student, 'key-2')).status).toBe(201);
    const res = await enroll(b, student, 'key-2');
    expect(res.status).toBe(422);
    expect(res.body.type).toMatch(/idempotency-key-reuse$/);
    expect(await seats(b)).toBe(0);
  });

  it('помилка не зберігається під ключем', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 1);
    expect((await enroll(stream, student)).status).toBe(201);
    const res = await enroll(stream, student2, 'key-3');
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/stream-full$/);
    expect(await savedKeys()).toBe(0);
  });

  it('однаковий ключ у різних студентів не конфліктує', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    const a = await enroll(stream, student, 'shared-key');
    const b = await enroll(stream, student2, 'shared-key');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers['idempotency-replayed']).toBe(undefined);
    expect(await seats(stream)).toBe(2);
    expect(await savedKeys()).toBe(2);
  });

  it('некоректний ключ → 400 validation', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    for (const key of ['has space', 'x'.repeat(256)]) {
      const res = await enroll(stream, student, key);
      expect(res.status).toBe(400);
      expect(res.body.type).toMatch(/validation$/);
    }
    expect(await seats(stream)).toBe(0);
  });

  it('ключ старший за добу вважається новим і повтор не відтворюється', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    expect((await enroll(stream, student, 'key-4')).status).toBe(201);
    await kit.pool.query(`UPDATE idempotency_keys SET created_at = now() - interval '25 hours'`);
    const res = await enroll(stream, student, 'key-4');
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/already-enrolled$/);
  });

  it('паралельні запити з одним ключем створюють один запис', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => enroll(stream, student, 'key-5')),
    );
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(results.filter((r) => r.headers['idempotency-replayed'] === 'true').length).toBe(7);
    expect(await seats(stream)).toBe(1);
    expect(await savedKeys()).toBe(1);
  });
});
