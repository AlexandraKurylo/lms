import { readdir } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherId: number;
let studentId: number;
let student: string;
let outsider: string;
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
      `INSERT INTO lessons(course_id, position, title, content, is_free_intro)
       VALUES ($1, $2, $3, 'Текст', $4) RETURNING id`,
      [course, position, `Урок ${position}`, position === 1],
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

beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await kit.clearUploads();
  teacherId = await kit.createUser('t@example.com', 'teacher');
  await kit.createUser('t2@example.com', 'teacher');
  await kit.createUser('a@example.com', 'admin');
  studentId = await kit.createUser('s@example.com', 'student');
  await kit.createUser('x@example.com', 'student');
  teacher = await kit.loginAs('t@example.com');
  otherTeacher = await kit.loginAs('t2@example.com');
  admin = await kit.loginAs('a@example.com');
  student = await kit.loginAs('s@example.com');
  outsider = await kit.loginAs('x@example.com');
  courseId = await kit.createCourse(teacherId, 'published');
  streamId = await createStream(courseId, -5);
  lessons = await addLessons(courseId);
  await kit.pool.query(
    `INSERT INTO enrollments(student_id, stream_id, course_id) VALUES ($1, $2, $3)`,
    [studentId, streamId, courseId],
  );
});

const list = (cookie: string, lesson: number) =>
  request(kit.app).get(`/api/teacher/lessons/${lesson}/materials`).set('Cookie', cookie);
const addLink = (cookie: string, lesson: number, body: unknown) =>
  request(kit.app)
    .post(`/api/teacher/lessons/${lesson}/materials`)
    .set('Cookie', cookie)
    .send(body as object);
const addFile = (
  cookie: string,
  lesson: number,
  name: string,
  data: string | Buffer = 'вміст',
  title?: string,
) => {
  const req = request(kit.app)
    .put(`/api/teacher/lessons/${lesson}/materials/file`)
    .set('Cookie', cookie)
    .set('Content-Type', 'application/octet-stream')
    .set('X-File-Name', encodeURIComponent(name));
  if (title !== undefined) req.set('X-Material-Title', encodeURIComponent(title));
  return req.send(Buffer.from(data));
};
const remove = (cookie: string, id: number) =>
  request(kit.app).delete(`/api/teacher/materials/${id}`).set('Cookie', cookie);
const download = (id: number, cookie?: string) => {
  const req = request(kit.app).get(`/api/materials/${id}/file`);
  return cookie ? req.set('Cookie', cookie) : req;
};
const stored = () => readdir(kit.uploadDir);

describe('матеріали уроку: керування викладачем', () => {
  it('без сесії → 401, студент → 403', async () => {
    const anon = await request(kit.app).get(`/api/teacher/lessons/${lessons[0]}/materials`);
    expect(anon.status).toBe(401);
    expect((await list(student, lessons[0]!)).status).toBe(403);
    expect((await addLink(student, lessons[0]!, {})).status).toBe(403);
  });

  it('посилання: створення, перелік, перевірка полів', async () => {
    const created = await addLink(teacher, lessons[1]!, {
      title: 'Відеоурок',
      kind: 'video',
      url: 'https://example.com/video',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Відеоурок',
      kind: 'video',
      url: 'https://example.com/video',
      fileName: null,
    });
    expect((await list(teacher, lessons[1]!)).body.items).toHaveLength(1);

    const bad = [
      { title: 'Назва', kind: 'video', url: 'javascript:alert(1)' },
      { title: 'Назва', kind: 'video', url: 'не посилання' },
      { title: 'a', kind: 'video', url: 'https://example.com' },
      { title: 'Назва', kind: 'file', url: 'https://example.com' },
      { title: 'Назва', kind: 'link', url: 'https://example.com', extra: 1 },
    ];
    for (const body of bad) {
      expect((await addLink(teacher, lessons[1]!, body)).status).toBe(400);
    }
  });

  it('чужий викладач → 404, адмін бачить усе', async () => {
    expect((await list(otherTeacher, lessons[0]!)).status).toBe(404);
    expect(
      (await addLink(otherTeacher, lessons[0]!, { title: 'Ab', kind: 'link', url: 'https://a.b' }))
        .status,
    ).toBe(404);
    expect((await addFile(otherTeacher, lessons[0]!, 'a.pdf')).status).toBe(404);
    expect((await list(admin, lessons[0]!)).status).toBe(200);
    expect((await list(teacher, 999999)).status).toBe(404);
  });

  it('файл: назва за замовчуванням, власна назва, відхилення типу й порожнього файлу', async () => {
    const plain = await addFile(teacher, lessons[0]!, 'Конспект.pdf');
    expect(plain.status).toBe(201);
    expect(plain.body).toMatchObject({
      title: 'Конспект.pdf',
      kind: 'file',
      fileName: 'Конспект.pdf',
    });
    expect(plain.body.url).toBe(`/api/materials/${plain.body.id}/file`);

    const titled = await addFile(teacher, lessons[0]!, 'a.zip', 'x', 'Архів із прикладами');
    expect(titled.body.title).toBe('Архів із прикладами');

    expect((await addFile(teacher, lessons[0]!, 'virus.exe')).status).toBe(400);
    expect((await addFile(teacher, lessons[0]!, 'a.pdf', '')).status).toBe(400);
    expect((await addFile(teacher, lessons[0]!, 'a.pdf', 'x', 'a')).status).toBe(400);
    expect(await stored()).toHaveLength(2);
  });

  it('видалення прибирає запис і файл, чужий викладач → 404', async () => {
    const file = await addFile(teacher, lessons[0]!, 'a.pdf');
    const id = file.body.id as number;
    expect((await remove(otherTeacher, id)).status).toBe(404);
    expect(await stored()).toHaveLength(1);
    expect((await remove(teacher, id)).status).toBe(204);
    expect(await stored()).toHaveLength(0);
    expect((await remove(teacher, id)).status).toBe(404);

    const link = await addLink(teacher, lessons[0]!, {
      title: 'Посилання',
      kind: 'link',
      url: 'https://example.com',
    });
    expect((await remove(admin, link.body.id)).status).toBe(204);
  });
});

describe('матеріали уроку: доступ до файлів', () => {
  async function fileIn(lesson: number): Promise<number> {
    const res = await addFile(teacher, lesson, 'Матеріал.txt', 'зміст матеріалу');
    return res.body.id as number;
  }

  it('студент бачить посилання на файл в уроці й скачує його', async () => {
    await kit.pool.query('UPDATE courses SET sequential_lessons = false');
    const id = await fileIn(lessons[1]!);
    const view = await request(kit.app).get(`/api/lessons/${lessons[1]}`).set('Cookie', student);
    expect(view.body.materials[0].url).toBe(`/api/materials/${id}/file`);

    const res = await download(id, student);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString('utf8')).toBe('зміст матеріалу');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(encodeURIComponent('Матеріал.txt'));
  });

  it('гість → 401, студент без запису → 403, чужий викладач → 404, власник і адмін → 200', async () => {
    await kit.pool.query('UPDATE courses SET sequential_lessons = false');
    const id = await fileIn(lessons[1]!);
    expect((await download(id)).status).toBe(401);
    expect((await download(id, outsider)).status).toBe(403);
    expect((await download(id, otherTeacher)).status).toBe(404);
    expect((await download(id, teacher)).status).toBe(200);
    expect((await download(id, admin)).status).toBe(200);
  });

  it('поки потік не розпочався або урок закритий по черзі → 403', async () => {
    const id = await fileIn(lessons[1]!);
    const locked = await download(id, student);
    expect(locked.status).toBe(403);
    expect(locked.body.type).toMatch(/lesson-locked$/);

    await kit.pool.query('UPDATE courses SET sequential_lessons = false');
    await kit.pool.query(
      'UPDATE streams SET starts_on = current_date + 5, ends_on = current_date + 65',
    );
    expect((await download(id, student)).status).toBe(403);
  });

  it('файл вступного уроку доступний гостям, а в чернетці курсу — ні', async () => {
    const id = await fileIn(lessons[0]!);
    expect((await download(id)).status).toBe(200);

    const intro = await request(kit.app).get(`/api/courses/${courseId}/intro-lesson`);
    expect(intro.body.materials[0].url).toBe(`/api/materials/${id}/file`);

    await kit.pool.query(`UPDATE courses SET status = 'draft'`);
    expect((await download(id)).status).toBe(401);
    expect((await download(id, outsider)).status).toBe(404);
    expect((await download(id, teacher)).status).toBe(200);
  });

  it('посилання не має файлу → 404, неіснуючий матеріал → 404', async () => {
    const link = await addLink(teacher, lessons[0]!, {
      title: 'Посилання',
      kind: 'link',
      url: 'https://example.com',
    });
    expect((await download(link.body.id, teacher)).status).toBe(404);
    expect((await download(999999, teacher)).status).toBe(404);
  });
});
