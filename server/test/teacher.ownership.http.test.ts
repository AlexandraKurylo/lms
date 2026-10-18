import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/shared/db.js';
import { createLogger } from '../src/shared/logger.js';
import { resetTestDatabase } from './helpers/testDb.js';

const PASSWORD = 'Passw0rd!';
const hasher = {
  hash: (p: string) => bcrypt.hash(p, 4),
  compare: (p: string, h: string) => bcrypt.compare(p, h),
};

const { Pool } = pg;
let pool: pg.Pool;
let prisma: ReturnType<typeof createPrisma>;
let app: ReturnType<typeof createApp>;

// cookie трьох ролей + другого викладача; заповнюється в beforeEach
let teacherA: string;
let teacherB: string;
let student: string;
let admin: string;
let teacherAId: number;

beforeAll(async () => {
  const url = await resetTestDatabase();
  pool = new Pool({ connectionString: url });
  prisma = createPrisma(url);
  app = createApp({
    logger: createLogger('silent'),
    db: prisma,
    jwtSecret: process.env.JWT_SECRET!,
    cookieSecure: false,
    hasher,
  });
});
afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});

async function createUser(email: string, role: 'student' | 'teacher' | 'admin'): Promise<number> {
  const user = await prisma.user.create({
    data: { email, name: `User ${role}`, role, passwordHash: await hasher.hash(PASSWORD) },
  });
  return user.id;
}
/** Входить через справжній /login і повертає заголовок Cookie для наступних запитів. */
async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const session = cookies.find((c) => c.startsWith('lms_session='))!;
  return session.split(';')[0]!;
}

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  teacherAId = await createUser('a@example.com', 'teacher');
  await createUser('b@example.com', 'teacher');
  await createUser('s@example.com', 'student');
  await createUser('admin@example.com', 'admin');
  teacherA = await loginAs('a@example.com');
  teacherB = await loginAs('b@example.com');
  student = await loginAs('s@example.com');
  admin = await loginAs('admin@example.com');
});

async function createCourseAs(cookie: string, title = 'Курс Олени') {
  const res = await request(app).post('/api/teacher/courses').set('Cookie', cookie).send({ title });
  expect(res.status).toBe(201);
  return res.body as { id: number; title: string; teacherId: number };
}

describe('рівні 1 і 2: хто взагалі може зайти в кабінет', () => {
  it('без сесії → 401', async () => {
    const res = await request(app).get('/api/teacher/courses');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('студент → 403 на будь-якому маршруті кабінету', async () => {
    expect((await request(app).get('/api/teacher/courses').set('Cookie', student)).status).toBe(403);
    expect(
      (await request(app).post('/api/teacher/courses').set('Cookie', student).send({ title: 'Хакер' }))
        .status,
    ).toBe(403);
  });
});

describe('рівень 3: власник у WHERE', () => {
  it('викладач створює курс, і власником стає він сам', async () => {
    const course = await createCourseAs(teacherA);
    expect(course.teacherId).toBe(teacherAId);
  });

  it('teacherId у тілі запиту відхиляється (власник лише із сесії)', async () => {
    const res = await request(app)
      .post('/api/teacher/courses')
      .set('Cookie', teacherB)
      .send({ title: 'Підміна власника', teacherId: teacherAId });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM courses');
    expect(rows[0].n).toBe(0);
  });

  it('зловмисник: викладач B змінює курс викладача A → 404, і курс не змінився', async () => {
    const course = await createCourseAs(teacherA);

    const res = await request(app)
      .patch(`/api/teacher/courses/${course.id}`)
      .set('Cookie', teacherB)
      .send({ title: 'Зламано викладачем B' });
    expect(res.status).toBe(404);

    const { rows } = await pool.query('SELECT title, teacher_id FROM courses WHERE id = $1', [
      course.id,
    ]);
    expect(rows[0].title).toBe('Курс Олени');
    expect(rows[0].teacher_id).toBe(teacherAId);
  });

  it('відповідь про чужий курс неможливо відрізнити від відповіді про неіснуючий', async () => {
    const course = await createCourseAs(teacherA);
    const foreign = await request(app)
      .get(`/api/teacher/courses/${course.id}`)
      .set('Cookie', teacherB);
    const missing = await request(app).get('/api/teacher/courses/99999').set('Cookie', teacherB);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.type).toBe(missing.body.type);
    expect(foreign.body.detail).toBe(missing.body.detail);
  });

  it('викладач B не додасть урок до курсу A', async () => {
    const course = await createCourseAs(teacherA);
    const res = await request(app)
      .post(`/api/teacher/courses/${course.id}/lessons`)
      .set('Cookie', teacherB)
      .send({ title: 'Чужий урок' });
    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM lessons');
    expect(rows[0].n).toBe(0);
  });

  it('власник змінює свій курс → 200', async () => {
    const course = await createCourseAs(teacherA);
    const res = await request(app)
      .patch(`/api/teacher/courses/${course.id}`)
      .set('Cookie', teacherA)
      .send({ title: 'Нова назва' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Нова назва');
  });

  it('список викладача містить лише його курси', async () => {
    await createCourseAs(teacherA, 'Курс A');
    await createCourseAs(teacherB, 'Курс B');
    const res = await request(app).get('/api/teacher/courses').set('Cookie', teacherA);
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: { title: string }) => c.title)).toEqual(['Курс A']);
  });

  it('адміністратор бачить і змінює курси всіх викладачів', async () => {
    const course = await createCourseAs(teacherA);
    const list = await request(app).get('/api/teacher/courses').set('Cookie', admin);
    expect(list.body.items).toHaveLength(1);
    const res = await request(app)
      .patch(`/api/teacher/courses/${course.id}`)
      .set('Cookie', admin)
      .send({ level: 'advanced' });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('advanced');
    expect(res.body.teacherId).toBe(teacherAId); // власник не змінився
  });
});

describe('публікація — справа адміністратора', () => {
  it('викладач не може опублікувати власний курс (status у тілі → 400)', async () => {
    const course = await createCourseAs(teacherA);
    const res = await request(app)
      .patch(`/api/teacher/courses/${course.id}`)
      .set('Cookie', teacherA)
      .send({ status: 'published' });
    expect(res.status).toBe(400);
  });

  it('викладач і студент не мають доступу до /admin → 403', async () => {
    const course = await createCourseAs(teacherA);
    for (const cookie of [teacherA, student]) {
      const res = await request(app)
        .patch(`/api/admin/courses/${course.id}/status`)
        .set('Cookie', cookie)
        .send({ status: 'published' });
      expect(res.status).toBe(403);
    }
  });

  it('адмін: курс без уроків не публікується (409), з уроком — публікується, знімається назад', async () => {
    const course = await createCourseAs(teacherA);
    const early = await request(app)
      .patch(`/api/admin/courses/${course.id}/status`)
      .set('Cookie', admin)
      .send({ status: 'published' });
    expect(early.status).toBe(409);

    const lesson = await request(app)
      .post(`/api/teacher/courses/${course.id}/lessons`)
      .set('Cookie', teacherA)
      .send({ title: 'Вступ' });
    expect(lesson.status).toBe(201);
    expect(lesson.body.position).toBe(1);

    const ok = await request(app)
      .patch(`/api/admin/courses/${course.id}/status`)
      .set('Cookie', admin)
      .send({ status: 'published' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('published');

    const back = await request(app)
      .patch(`/api/admin/courses/${course.id}/status`)
      .set('Cookie', admin)
      .send({ status: 'draft' });
    expect(back.body.status).toBe('draft');
  });

  it('адмін призначає іншого викладача, і курс переходить до нього', async () => {
    const course = await createCourseAs(teacherA);
    const { rows } = await pool.query("SELECT id FROM users WHERE email = 'b@example.com'");
    const bId = rows[0].id as number;

    const res = await request(app)
      .patch(`/api/admin/courses/${course.id}/teacher`)
      .set('Cookie', admin)
      .send({ teacherId: bId });
    expect(res.status).toBe(200);

    expect(
      (await request(app).get(`/api/teacher/courses/${course.id}`).set('Cookie', teacherB)).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/teacher/courses/${course.id}`).set('Cookie', teacherA)).status,
    ).toBe(404);
  });

  it('призначити студента викладачем не можна → 400', async () => {
    const course = await createCourseAs(teacherA);
    const { rows } = await pool.query("SELECT id FROM users WHERE email = 's@example.com'");
    const res = await request(app)
      .patch(`/api/admin/courses/${course.id}/teacher`)
      .set('Cookie', admin)
      .send({ teacherId: rows[0].id });
    expect(res.status).toBe(400);
  });

  it('порожнє тіло PATCH курсу → 400', async () => {
    const course = await createCourseAs(teacherA);
    const res = await request(app)
      .patch(`/api/teacher/courses/${course.id}`)
      .set('Cookie', teacherA)
      .send({});
    expect(res.status).toBe(400);
  });
});
