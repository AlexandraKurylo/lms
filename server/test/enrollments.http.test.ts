import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherId: number;
let student: string;
let student2: string;
let teacher: string;

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
  teacher = await kit.loginAs('t@example.com');
  student = await kit.loginAs('s1@example.com');
  student2 = await kit.loginAs('s2@example.com');
});

const enroll = (streamId: number, cookie?: string) => {
  const req = request(kit.app).post(`/api/streams/${streamId}/enrollments`);
  return cookie ? req.set('Cookie', cookie) : req;
};
const seats = async (streamId: number) =>
  (
    await kit.pool.query(
      `SELECT count(*)::int AS n FROM enrollments WHERE stream_id = $1 AND status IN ('active','completed')`,
      [streamId],
    )
  ).rows[0].n as number;

describe('доступ', () => {
  it('без сесії → 401, викладач → 403', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5);
    expect((await enroll(stream)).status).toBe(401);
    expect((await enroll(stream, teacher)).status).toBe(403);
  });
});

describe('запис на потік', () => {
  it('студент записується → 201 і місце зайнято', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 2);
    const res = await enroll(stream, student);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(await seats(stream)).toBe(1);
  });

  it('повторний запис на той самий потік → 409 already-enrolled', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 2);
    await enroll(stream, student);
    const res = await enroll(stream, student);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/already-enrolled$/);
  });

  it('другий потік того самого курсу → 409 already-enrolled', async () => {
    const course = await kit.createCourse(teacherId);
    const a = await kit.createStream(course, 2);
    const b = await kit.createStream(course, 2);
    expect((await enroll(a, student)).status).toBe(201);
    const res = await enroll(b, student);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/already-enrolled$/);
  });

  it('потік заповнено → 409 stream-full', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 1);
    expect((await enroll(stream, student)).status).toBe(201);
    const res = await enroll(stream, student2);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/stream-full$/);
  });

  it('потік завершився → 409 stream-closed', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 5, '2020-01-01');
    const res = await enroll(stream, student);
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/stream-closed$/);
  });

  it('неіснуючий потік і потік чернетки → однаковий 404', async () => {
    const draft = await kit.createStream(await kit.createCourse(teacherId, 'draft'), 5);
    const a = await enroll(draft, student);
    const b = await enroll(99999, student);
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(a.body.type).toBe(b.body.type);
  });

  it('нечисловий id → 400', async () => {
    expect((await enroll('abc' as unknown as number, student)).status).toBe(400);
  });
});

describe('скасування й мої записи', () => {
  it('скасований запис звільняє місце, а студент може записатися знову', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 1);
    const created = await enroll(stream, student);
    expect((await enroll(stream, student2)).status).toBe(409);

    const del = await request(kit.app)
      .delete(`/api/me/enrollments/${created.body.id}`)
      .set('Cookie', student);
    expect(del.status).toBe(204);
    expect(await seats(stream)).toBe(0);

    expect((await enroll(stream, student2)).status).toBe(201);
  });

  it('після скасування той самий студент записується на той самий потік (рядок відновлюється)', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 3);
    const first = await enroll(stream, student);
    await request(kit.app).delete(`/api/me/enrollments/${first.body.id}`).set('Cookie', student);
    const again = await enroll(stream, student);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await seats(stream)).toBe(1);
  });

  it('чужий запис скасувати не можна → 404, запис залишився', async () => {
    const stream = await kit.createStream(await kit.createCourse(teacherId), 3);
    const created = await enroll(stream, student);
    const res = await request(kit.app)
      .delete(`/api/me/enrollments/${created.body.id}`)
      .set('Cookie', student2);
    expect(res.status).toBe(404);
    expect(await seats(stream)).toBe(1);
  });

  it('GET /me/enrollments показує лише власні записи', async () => {
    const course = await kit.createCourse(teacherId);
    const stream = await kit.createStream(course, 3);
    await enroll(stream, student);
    const mine = await request(kit.app).get('/api/me/enrollments').set('Cookie', student);
    const other = await request(kit.app).get('/api/me/enrollments').set('Cookie', student2);
    expect(mine.status).toBe(200);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].stream.id).toBe(stream);
    expect(other.body.items).toHaveLength(0);
  });
});
