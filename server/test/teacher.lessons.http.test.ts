import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacher: string;
let other: string;
let admin: string;
let student: string;
let courseId: number;
let lessonId: number;

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});
beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  const t = await kit.createUser('t@example.com', 'teacher');
  await kit.createUser('o@example.com', 'teacher');
  await kit.createUser('a@example.com', 'admin');
  await kit.createUser('s@example.com', 'student');
  teacher = await kit.loginAs('t@example.com');
  other = await kit.loginAs('o@example.com');
  admin = await kit.loginAs('a@example.com');
  student = await kit.loginAs('s@example.com');
  courseId = await kit.createCourse(t, 'published');
  const { rows } = await kit.pool.query(
    `INSERT INTO lessons(course_id, position, title, content) VALUES ($1, 1, 'Старий урок', 'Старий текст') RETURNING id`,
    [courseId],
  );
  lessonId = rows[0].id as number;
});

const get = (cookie: string, id = lessonId) =>
  request(kit.app).get(`/api/teacher/lessons/${id}`).set('Cookie', cookie);
const patch = (cookie: string, data: object, id = lessonId) =>
  request(kit.app).patch(`/api/teacher/lessons/${id}`).set('Cookie', cookie).send(data);

describe('перегляд і редагування уроків у кабінеті викладача', () => {
  it('студент → 403, без сесії → 401', async () => {
    expect((await get(student)).status).toBe(403);
    expect((await request(kit.app).get(`/api/teacher/lessons/${lessonId}`)).status).toBe(401);
  });

  it('викладач бачить свій урок разом із текстом і назвою курсу', async () => {
    const res = await get(teacher);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: lessonId,
      courseId,
      title: 'Старий урок',
      content: 'Старий текст',
    });
  });

  it('викладач змінює урок одразу, навіть в опублікованому курсі', async () => {
    const res = await patch(teacher, { title: 'Новий урок', content: 'Новий текст' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Новий урок');
    const { rows } = await kit.pool.query('SELECT title, content FROM lessons WHERE id = $1', [
      lessonId,
    ]);
    expect(rows[0]).toEqual({ title: 'Новий урок', content: 'Новий текст' });
  });

  it('частковий запис не чіпає інші поля', async () => {
    await patch(teacher, { hasHomework: true });
    const { rows } = await kit.pool.query('SELECT title, has_homework FROM lessons WHERE id = $1', [
      lessonId,
    ]);
    expect(rows[0]).toEqual({ title: 'Старий урок', has_homework: true });
  });

  it('адмін бачить і змінює будь-який урок', async () => {
    expect((await get(admin)).status).toBe(200);
    expect((await patch(admin, { title: 'Від адміна' })).status).toBe(200);
  });

  it('чужий урок → 404 і не змінюється', async () => {
    expect((await get(other)).status).toBe(404);
    expect((await patch(other, { title: 'Злам' })).status).toBe(404);
    const { rows } = await kit.pool.query('SELECT title FROM lessons WHERE id = $1', [lessonId]);
    expect(rows[0].title).toBe('Старий урок');
  });

  it('порожнє тіло, зайве поле або коротка назва → 400', async () => {
    expect((await patch(teacher, {})).status).toBe(400);
    expect((await patch(teacher, { position: 5 })).status).toBe(400);
    expect((await patch(teacher, { title: 'а' })).status).toBe(400);
  });

  it('другий безкоштовний вступний урок у курсі → 400', async () => {
    await kit.pool.query(
      `INSERT INTO lessons(course_id, position, title, is_free_intro) VALUES ($1, 2, 'Вступ', true)`,
      [courseId],
    );
    const res = await patch(teacher, { isFreeIntro: true });
    expect(res.status).toBe(400);
  });

  it('неіснуючий урок → 404', async () => {
    expect((await get(teacher, 99999)).status).toBe(404);
  });
});
