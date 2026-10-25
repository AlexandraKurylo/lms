import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherId: number;
let studentId: number;
let student: string;
let stranger: string;
let teacher: string;
let courseId: number;
let streamId: number;
let lessons: number[];

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});

async function addLessons(course: number, count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let position = 1; position <= count; position++) {
    const { rows } = await kit.pool.query(
      `INSERT INTO lessons(course_id, position, title, content, is_free_intro)
       VALUES ($1, $2, $3, 'Текст', $4) RETURNING id`,
      [course, position, `Урок ${position}`, position === 1],
    );
    ids.push(rows[0].id as number);
  }
  return ids;
}

async function enrollStudent(status: 'active' | 'completed' | 'cancelled' = 'active') {
  await kit.pool.query(
    `INSERT INTO enrollments(student_id, stream_id, course_id, status) VALUES ($1, $2, $3, $4)`,
    [studentId, streamId, courseId, status],
  );
}

beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  teacherId = await kit.createUser('t@example.com', 'teacher');
  studentId = await kit.createUser('s@example.com', 'student');
  await kit.createUser('x@example.com', 'student');
  teacher = await kit.loginAs('t@example.com');
  student = await kit.loginAs('s@example.com');
  stranger = await kit.loginAs('x@example.com');
  courseId = await kit.createCourse(teacherId, 'published');
  streamId = await kit.createStream(courseId, 10);
  lessons = await addLessons(courseId, 3);
});

const get = (cookie: string, id: number) =>
  request(kit.app).get(`/api/lessons/${id}`).set('Cookie', cookie);
const done = (cookie: string, id: number) =>
  request(kit.app).put(`/api/lessons/${id}/progress`).set('Cookie', cookie);
const undo = (cookie: string, id: number) =>
  request(kit.app).delete(`/api/lessons/${id}/progress`).set('Cookie', cookie);
const outline = (cookie: string, course = courseId) =>
  request(kit.app).get(`/api/me/courses/${course}/progress`).set('Cookie', cookie);

describe('перегляд уроків і прогрес студента', () => {
  it('без сесії → 401, викладач → 403', async () => {
    expect((await request(kit.app).get(`/api/lessons/${lessons[0]}`)).status).toBe(401);
    expect((await get(teacher, lessons[0]!)).status).toBe(403);
  });

  it('без запису на курс → 403 not-enrolled, у чужого студента так само', async () => {
    await enrollStudent();
    const res = await get(stranger, lessons[0]!);
    expect(res.status).toBe(403);
    expect(res.body.type).toMatch(/not-enrolled$/);
    expect((await outline(stranger)).status).toBe(403);
  });

  it('скасований запис місця не дає → 403', async () => {
    await enrollStudent('cancelled');
    expect((await get(student, lessons[0]!)).status).toBe(403);
  });

  it('завершений запис дає читати уроки', async () => {
    await enrollStudent('completed');
    expect((await get(student, lessons[0]!)).status).toBe(200);
  });

  it('чернетка курсу й неіснуючий урок → 404', async () => {
    await enrollStudent();
    const draft = await kit.createCourse(teacherId, 'draft');
    const [draftLesson] = await addLessons(draft, 1);
    expect((await get(student, draftLesson!)).status).toBe(404);
    expect((await get(student, 999999)).status).toBe(404);
  });

  it('перший урок відкритий, другий закритий, поки перший не пройдено', async () => {
    await enrollStudent();
    const first = await get(student, lessons[0]!);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      title: 'Урок 1',
      content: 'Текст',
      completed: false,
      previousLessonId: null,
      nextLessonId: lessons[1],
    });

    const second = await get(student, lessons[1]!);
    expect(second.status).toBe(403);
    expect(second.body.type).toMatch(/lesson-locked$/);
    expect((await done(student, lessons[1]!)).status).toBe(403);
  });

  it('позначка відкриває наступний урок і рахує відсотки', async () => {
    await enrollStudent();
    const marked = await done(student, lessons[0]!);
    expect(marked.status).toBe(200);
    expect(marked.body).toEqual({ completed: 1, total: 3, percent: 33 });
    expect((await get(student, lessons[1]!)).status).toBe(200);

    const list = await outline(student);
    expect(list.body.progress).toEqual({ completed: 1, total: 3, percent: 33 });
    expect(list.body.lessons.map((l: { completed: boolean }) => l.completed)).toEqual([
      true,
      false,
      false,
    ]);
    expect(list.body.lessons.map((l: { locked: boolean }) => l.locked)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('повторна позначка нічого не ламає', async () => {
    await enrollStudent();
    await done(student, lessons[0]!);
    const again = await done(student, lessons[0]!);
    expect(again.status).toBe(200);
    expect(again.body.completed).toBe(1);
    const { rows } = await kit.pool.query('SELECT 1 FROM lesson_progress WHERE student_id = $1', [
      studentId,
    ]);
    expect(rows).toHaveLength(1);
  });

  it('знімати позначку не можна, якщо пройдено пізніший урок → 409', async () => {
    await enrollStudent();
    await done(student, lessons[0]!);
    await done(student, lessons[1]!);
    const blocked = await undo(student, lessons[0]!);
    expect(blocked.status).toBe(409);
    expect(blocked.body.type).toMatch(/has-later-progress$/);

    const ok = await undo(student, lessons[1]!);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ completed: 1, total: 3, percent: 33 });
  });

  it('у курсі без режиму «по черзі» всі уроки відкриті й позначку можна знімати довільно', async () => {
    await kit.pool.query('UPDATE courses SET sequential_lessons = false WHERE id = $1', [courseId]);
    await enrollStudent();
    expect((await get(student, lessons[2]!)).status).toBe(200);
    await done(student, lessons[2]!);
    await done(student, lessons[0]!);
    expect((await undo(student, lessons[0]!)).status).toBe(200);
    const list = await outline(student);
    expect(list.body.lessons.every((l: { locked: boolean }) => !l.locked)).toBe(true);
  });

  it('усі уроки пройдено → 100%', async () => {
    await enrollStudent();
    for (const id of lessons) await done(student, id);
    expect((await outline(student)).body.progress.percent).toBe(100);
  });

  it('«Мої записи» повертають прогрес по курсу', async () => {
    await enrollStudent();
    await done(student, lessons[0]!);
    const mine = await request(kit.app).get('/api/me/enrollments').set('Cookie', student);
    expect(mine.body.items[0].progress).toEqual({ completed: 1, total: 3, percent: 33 });
  });
});
