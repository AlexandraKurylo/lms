import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});

describe('конкурентний запис', () => {
  it('50 одночасних запитів на 10 місць → рівно 10 успіхів, решта stream-full', async () => {
    await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const teacherId = await kit.createUser('t@example.com', 'teacher');
    const course = await kit.createCourse(teacherId);
    const stream = await kit.createStream(course, 10);

    const cookies: string[] = [];
    for (let i = 0; i < 50; i++) {
      await kit.createUser(`s${i}@example.com`, 'student');
      cookies.push(await kit.loginAs(`s${i}@example.com`));
    }

    const results = await Promise.all(
      cookies.map((c) =>
        request(kit.app).post(`/api/streams/${stream}/enrollments`).set('Cookie', c),
      ),
    );

    const created = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.status === 409 && /stream-full$/.test(r.body.type)).length;
    expect(created).toBe(10);
    expect(full).toBe(40);

    const { rows } = await kit.pool.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE stream_id = $1 AND status = 'active'`,
      [stream],
    );
    expect(rows[0].n).toBe(10);
  }, 60_000);

  it('один студент шле 5 однакових запитів → один запис', async () => {
    await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const teacherId = await kit.createUser('t@example.com', 'teacher');
    const stream = await kit.createStream(await kit.createCourse(teacherId), 10);
    await kit.createUser('s@example.com', 'student');
    const cookie = await kit.loginAs('s@example.com');

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(kit.app).post(`/api/streams/${stream}/enrollments`).set('Cookie', cookie),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  }, 30_000);
});
