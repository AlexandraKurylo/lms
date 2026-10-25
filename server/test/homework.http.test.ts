import { readdir } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherId: number;
let studentId: number;
let student: string;
let second: string;
let teacher: string;
let otherTeacher: string;
let admin: string;
let courseId: number;
let streamId: number;
let lessons: number[];

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});

async function addLessons(course: number): Promise<number[]> {
  const ids: number[] = [];
  for (let position = 1; position <= 3; position++) {
    const { rows } = await kit.pool.query(
      `INSERT INTO lessons(course_id, position, title, content, is_free_intro, has_homework)
       VALUES ($1, $2, $3, 'Текст', $4, $5) RETURNING id`,
      [course, position, `Урок ${position}`, position === 1, position !== 3],
    );
    ids.push(rows[0].id as number);
  }
  return ids;
}

async function createStream(course: number, startsInDays: number): Promise<number> {
  const { rows } = await kit.pool.query(
    `INSERT INTO streams(course_id, title, starts_on, ends_on, capacity)
     VALUES ($1, 'Потік', current_date + $2::int, current_date + $2::int + 60, 10) RETURNING id`,
    [course, startsInDays],
  );
  return rows[0].id as number;
}

async function enroll(userId: number, stream = streamId, course = courseId) {
  await kit.pool.query(
    `INSERT INTO enrollments(student_id, stream_id, course_id) VALUES ($1, $2, $3)`,
    [userId, stream, course],
  );
}

beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await kit.clearUploads();
  teacherId = await kit.createUser('t@example.com', 'teacher');
  await kit.createUser('t2@example.com', 'teacher');
  await kit.createUser('a@example.com', 'admin');
  studentId = await kit.createUser('s@example.com', 'student');
  const secondId = await kit.createUser('s2@example.com', 'student');
  teacher = await kit.loginAs('t@example.com');
  otherTeacher = await kit.loginAs('t2@example.com');
  admin = await kit.loginAs('a@example.com');
  student = await kit.loginAs('s@example.com');
  second = await kit.loginAs('s2@example.com');
  courseId = await kit.createCourse(teacherId, 'published');
  await kit.pool.query('UPDATE courses SET sequential_lessons = false WHERE id = $1', [courseId]);
  streamId = await createStream(courseId, -5);
  lessons = await addLessons(courseId);
  await enroll(studentId);
  await enroll(secondId);
});

const submit = (cookie: string, lesson: number, body: unknown) =>
  request(kit.app)
    .put(`/api/lessons/${lesson}/submission`)
    .set('Cookie', cookie)
    .send(body as object);
const lessonView = (cookie: string, lesson: number) =>
  request(kit.app).get(`/api/lessons/${lesson}`).set('Cookie', cookie);
const grade = (cookie: string, id: number, body: unknown) =>
  request(kit.app)
    .put(`/api/teacher/submissions/${id}/grade`)
    .set('Cookie', cookie)
    .send(body as object);
const submissions = (cookie: string, query = '', stream = streamId) =>
  request(kit.app).get(`/api/teacher/streams/${stream}/submissions${query}`).set('Cookie', cookie);
const students = (cookie: string, stream = streamId) =>
  request(kit.app).get(`/api/teacher/streams/${stream}/students`).set('Cookie', cookie);

describe('домашні роботи студента', () => {
  it('без сесії → 401, викладач → 403', async () => {
    const anon = await request(kit.app)
      .put(`/api/lessons/${lessons[0]}/submission`)
      .send({ comment: 'x' });
    expect(anon.status).toBe(401);
    expect((await submit(teacher, lessons[0]!, { comment: 'x' })).status).toBe(403);
  });

  it('урок без домашнього завдання → 400', async () => {
    const res = await submit(student, lessons[2]!, { comment: 'Відповідь' });
    expect(res.status).toBe(400);
  });

  it('порожня й надто довга відповідь → 400, зайві поля → 400', async () => {
    expect((await submit(student, lessons[0]!, { comment: '   ' })).status).toBe(400);
    expect((await submit(student, lessons[0]!, { comment: 'a'.repeat(10_001) })).status).toBe(400);
    expect((await submit(student, lessons[0]!, { comment: 'ok', grade: 100 })).status).toBe(400);
  });

  it('надсилання зберігається й видно в уроці, повторне замінює відповідь', async () => {
    const first = await submit(student, lessons[0]!, { comment: 'Перша версія' });
    expect(first.status).toBe(200);
    expect(first.body.grade).toBeNull();

    const again = await submit(student, lessons[0]!, { comment: 'Друга версія' });
    expect(again.status).toBe(200);
    const view = await lessonView(student, lessons[0]!);
    expect(view.body.submission.comment).toBe('Друга версія');
    const { rows } = await kit.pool.query('SELECT count(*)::int AS n FROM submissions');
    expect(rows[0].n).toBe(1);
  });

  it('урок без завдання повертає submission: null', async () => {
    const view = await lessonView(student, lessons[2]!);
    expect(view.body.submission).toBeNull();
  });

  it('без запису на курс → 403, поки потік не розпочався → 403', async () => {
    await kit.createUser('x@example.com', 'student');
    const cookie = await kit.loginAs('x@example.com');
    const res = await submit(cookie, lessons[0]!, { comment: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.type).toMatch(/not-enrolled$/);

    await kit.pool.query(
      'UPDATE streams SET starts_on = current_date + 5, ends_on = current_date + 65',
    );
    const early = await submit(student, lessons[0]!, { comment: 'x' });
    expect(early.status).toBe(403);
    expect(early.body.type).toMatch(/stream-not-started$/);
  });

  it('після оцінювання роботу змінити не можна → 409', async () => {
    await submit(student, lessons[0]!, { comment: 'Відповідь' });
    const list = await submissions(teacher);
    const id = list.body.items[0].id as number;
    expect((await grade(teacher, id, { grade: 90, feedback: 'Добре' })).status).toBe(200);

    const res = await submit(student, lessons[0]!, { comment: 'Змінюю' });
    expect(res.status).toBe(409);
    expect(res.body.type).toMatch(/submission-graded$/);
    const view = await lessonView(student, lessons[0]!);
    expect(view.body.submission.comment).toBe('Відповідь');
    expect(view.body.submission.grade).toBe(90);
    expect(view.body.submission.feedback).toBe('Добре');
  });
});

describe('перевірка робіт викладачем', () => {
  it('студент → 403, без сесії → 401', async () => {
    expect((await submissions(student)).status).toBe(403);
    expect((await students(student)).status).toBe(403);
    expect((await grade(student, 1, { grade: 5 })).status).toBe(403);
    expect((await request(kit.app).get(`/api/teacher/streams/${streamId}/students`)).status).toBe(
      401,
    );
  });

  it('чужий викладач бачить 404, адмін бачить усе', async () => {
    await submit(student, lessons[0]!, { comment: 'Відповідь' });
    const id = (await submissions(teacher)).body.items[0].id as number;

    expect((await submissions(otherTeacher)).status).toBe(404);
    expect((await students(otherTeacher)).status).toBe(404);
    expect((await grade(otherTeacher, id, { grade: 50 })).status).toBe(404);
    expect((await submissions(admin)).status).toBe(200);
    expect((await grade(admin, id, { grade: 50 })).status).toBe(200);
  });

  it('список робіт: фільтр за статусом і відомості про студента й урок', async () => {
    await submit(student, lessons[0]!, { comment: 'Один' });
    await submit(second, lessons[1]!, { comment: 'Два' });
    const all = await submissions(teacher);
    expect(all.body.items).toHaveLength(2);
    const gradedId = all.body.items.find((i: { comment: string }) => i.comment === 'Один').id;
    await grade(teacher, gradedId, { grade: 80 });

    const pending = await submissions(teacher, '?status=pending');
    expect(pending.body.items.map((i: { comment: string }) => i.comment)).toEqual(['Два']);
    const done = await submissions(teacher, '?status=graded');
    expect(done.body.items).toHaveLength(1);
    expect(done.body.items[0]).toMatchObject({
      comment: 'Один',
      grade: 80,
      student: { name: 'User student' },
      lesson: { position: 1, title: 'Урок 1' },
    });
    expect((await submissions(teacher, '?status=bogus')).status).toBe(400);
  });

  it('оцінка 0–100 цілим числом, коментар необов’язковий і його можна змінити', async () => {
    await submit(student, lessons[0]!, { comment: 'Відповідь' });
    const id = (await submissions(teacher)).body.items[0].id as number;

    for (const bad of [{ grade: -1 }, { grade: 101 }, { grade: 5.5 }, { grade: '90' }, {}]) {
      expect((await grade(teacher, id, bad)).status).toBe(400);
    }
    const first = await grade(teacher, id, { grade: 70, feedback: 'Потрібно краще' });
    expect(first.body).toMatchObject({ grade: 70, feedback: 'Потрібно краще' });
    expect(first.body.gradedAt).not.toBeNull();

    const regraded = await grade(teacher, id, { grade: 95 });
    expect(regraded.body).toMatchObject({ grade: 95, feedback: null });
    expect((await grade(teacher, 999999, { grade: 10 })).status).toBe(404);
  });

  it('список студентів потоку з прогресом і домашніми', async () => {
    await kit.pool.query(
      `INSERT INTO lesson_progress(student_id, lesson_id) VALUES ($1, $2), ($1, $3)`,
      [studentId, lessons[0], lessons[1]],
    );
    await submit(student, lessons[0]!, { comment: 'Відповідь' });
    const id = (await submissions(teacher)).body.items[0].id as number;
    await grade(teacher, id, { grade: 88 });
    await kit.pool.query(
      `INSERT INTO enrollments(student_id, stream_id, course_id, status)
       VALUES ((SELECT id FROM users WHERE email = 'a@example.com'), $1, $2, 'cancelled')`,
      [streamId, courseId],
    );

    const res = await students(teacher);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const row = res.body.items.find((i: { email: string }) => i.email === 's@example.com');
    expect(row.progress).toEqual({ completed: 2, total: 3, percent: 67 });
    expect(row.homework).toEqual({ total: 2, submitted: 1, graded: 1 });
    const other = res.body.items.find((i: { email: string }) => i.email === 's2@example.com');
    expect(other.progress.percent).toBe(0);
    expect(other.homework).toEqual({ total: 2, submitted: 0, graded: 0 });
  });
});

const upload = (cookie: string, lesson: number, name: string, data: string | Buffer = 'вміст') =>
  request(kit.app)
    .put(`/api/lessons/${lesson}/submission/file`)
    .set('Cookie', cookie)
    .set('Content-Type', 'application/octet-stream')
    .set('X-File-Name', encodeURIComponent(name))
    .send(Buffer.from(data));
const download = (cookie: string, lesson: number) =>
  request(kit.app).get(`/api/lessons/${lesson}/submission/file`).set('Cookie', cookie);
const removeFile = (cookie: string, lesson: number) =>
  request(kit.app).delete(`/api/lessons/${lesson}/submission/file`).set('Cookie', cookie);
const teacherDownload = (cookie: string, id: number) =>
  request(kit.app).get(`/api/teacher/submissions/${id}/file`).set('Cookie', cookie);
const storedFiles = () => readdir(kit.uploadDir);

describe('файли до домашніх робіт', () => {
  it('файл без тексту зберігається, видно в уроці, текст можна додати пізніше', async () => {
    const res = await upload(student, lessons[0]!, 'Звіт.pdf');
    expect(res.status).toBe(200);
    expect(res.body.file).toEqual({ name: 'Звіт.pdf' });
    expect(res.body.comment).toBe('');

    expect((await submit(student, lessons[0]!, { comment: '' })).status).toBe(200);
    const withText = await submit(student, lessons[0]!, { comment: 'Дивіться файл' });
    expect(withText.body.file).toEqual({ name: 'Звіт.pdf' });
    const view = await lessonView(student, lessons[0]!);
    expect(view.body.submission.file).toEqual({ name: 'Звіт.pdf' });
  });

  it('пуста відповідь без файлу → 400', async () => {
    const res = await submit(student, lessons[0]!, { comment: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('body.comment');
  });

  it('недозволений тип, порожній файл, без назви → 400, завеликий → 413', async () => {
    expect((await upload(student, lessons[0]!, 'virus.exe')).status).toBe(400);
    expect((await upload(student, lessons[0]!, 'без-розширення')).status).toBe(400);
    expect((await upload(student, lessons[0]!, 'a.pdf', '')).status).toBe(400);
    const noName = await request(kit.app)
      .put(`/api/lessons/${lessons[0]}/submission/file`)
      .set('Cookie', student)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));
    expect(noName.status).toBe(400);

    const big = await upload(student, lessons[0]!, 'big.zip', Buffer.alloc(10 * 1024 * 1024 + 1));
    expect(big.status).toBe(413);
    expect(await storedFiles()).toHaveLength(0);
  });

  it('шлях у назві відкидається, зберігається лише ім’я', async () => {
    const res = await upload(student, lessons[0]!, '..\\..\\etc\\task.txt');
    expect(res.status).toBe(200);
    expect(res.body.file.name).toBe('task.txt');
  });

  it('роль і доступ: викладач → 403, без запису → 403, урок без завдання → 400', async () => {
    expect((await upload(teacher, lessons[0]!, 'a.pdf')).status).toBe(403);
    await kit.createUser('x@example.com', 'student');
    const stranger = await kit.loginAs('x@example.com');
    expect((await upload(stranger, lessons[0]!, 'a.pdf')).status).toBe(403);
    expect((await upload(student, lessons[2]!, 'a.pdf')).status).toBe(400);
  });

  it('повторне надсилання замінює файл на диску', async () => {
    await upload(student, lessons[0]!, 'one.txt', 'перший');
    await upload(student, lessons[0]!, 'two.txt', 'другий');
    expect(await storedFiles()).toHaveLength(1);
    const res = await download(student, lessons[0]!);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString('utf8')).toBe('другий');
  });

  it('скачування: заголовки безпеки, чужий студент і чужий викладач не мають доступу', async () => {
    await upload(student, lessons[0]!, 'Звіт.txt', 'зміст звіту');
    const mine = await download(student, lessons[0]!);
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toContain('application/octet-stream');
    expect(mine.headers['x-content-type-options']).toBe('nosniff');
    expect(mine.headers['content-disposition']).toContain('attachment');
    expect(mine.headers['content-disposition']).toContain(encodeURIComponent('Звіт.txt'));
    expect((await download(second, lessons[0]!)).status).toBe(404);

    const id = (await submissions(teacher)).body.items[0].id as number;
    const forTeacher = await teacherDownload(teacher, id);
    expect(forTeacher.status).toBe(200);
    expect(Buffer.from(forTeacher.body).toString('utf8')).toBe('зміст звіту');
    expect((await teacherDownload(admin, id)).status).toBe(200);
    expect((await teacherDownload(otherTeacher, id)).status).toBe(404);
    expect((await teacherDownload(student, id)).status).toBe(403);
    expect((await submissions(teacher)).body.items[0].file).toEqual({ name: 'Звіт.txt' });
  });

  it('видалення файлу: без тексту прибирає роботу, з текстом залишає відповідь', async () => {
    await upload(student, lessons[0]!, 'a.txt');
    expect((await removeFile(student, lessons[0]!)).status).toBe(204);
    const gone = await kit.pool.query('SELECT count(*)::int AS n FROM submissions');
    expect(gone.rows[0].n).toBe(0);
    expect(await storedFiles()).toHaveLength(0);

    await upload(student, lessons[1]!, 'b.txt');
    await submit(student, lessons[1]!, { comment: 'Текст лишається' });
    expect((await removeFile(student, lessons[1]!)).status).toBe(204);
    const view = await lessonView(student, lessons[1]!);
    expect(view.body.submission).toMatchObject({ comment: 'Текст лишається', file: null });
    expect(await storedFiles()).toHaveLength(0);
    expect((await removeFile(student, lessons[1]!)).status).toBe(204);
  });

  it('після оцінювання файл не змінюється й не видаляється → 409', async () => {
    await upload(student, lessons[0]!, 'a.txt', 'оригінал');
    const id = (await submissions(teacher)).body.items[0].id as number;
    await grade(teacher, id, { grade: 75 });

    const replace = await upload(student, lessons[0]!, 'b.txt', 'підміна');
    expect(replace.status).toBe(409);
    expect(replace.body.type).toMatch(/submission-graded$/);
    expect((await removeFile(student, lessons[0]!)).status).toBe(409);
    expect(await storedFiles()).toHaveLength(1);
    expect(Buffer.from((await download(student, lessons[0]!)).body).toString('utf8')).toBe(
      'оригінал',
    );
  });

  it('поки потік не розпочався, файл завантажити не можна', async () => {
    await kit.pool.query(
      'UPDATE streams SET starts_on = current_date + 5, ends_on = current_date + 65',
    );
    const res = await upload(student, lessons[0]!, 'a.pdf');
    expect(res.status).toBe(403);
    expect(res.body.type).toMatch(/stream-not-started$/);
  });
});
