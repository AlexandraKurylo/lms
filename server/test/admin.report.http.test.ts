import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let admin: string;
let teacher: string;
let student: string;
let teacherId: number;
let courseId: number;
let streamId: number;
let anna: number;
let bohdan: number;
let lessonIds: number[];

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});

beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  await kit.createUser('admin@example.com', 'admin');
  teacherId = await kit.createUser('t@example.com', 'teacher');
  anna = await kit.createUser('anna@example.com', 'student');
  bohdan = await kit.createUser('bohdan@example.com', 'student');
  admin = await kit.loginAs('admin@example.com');
  teacher = await kit.loginAs('t@example.com');
  student = await kit.loginAs('anna@example.com');

  courseId = await kit.createCourse(teacherId);
  streamId = await kit.createStream(courseId, 10);
  lessonIds = [];
  for (const position of [1, 2, 3, 4]) {
    const lesson = await kit.prisma.lesson.create({
      data: { courseId, position, title: `Урок ${position}`, hasHomework: position <= 2 },
    });
    lessonIds.push(lesson.id);
  }
  for (const studentId of [anna, bohdan]) {
    await kit.prisma.enrollment.create({ data: { studentId, streamId, courseId } });
  }
  await kit.prisma.lessonProgress.createMany({
    data: lessonIds.map((lessonId) => ({ studentId: anna, lessonId })),
  });
  await kit.prisma.lessonProgress.create({ data: { studentId: bohdan, lessonId: lessonIds[0]! } });
  await kit.prisma.submission.create({
    data: { studentId: anna, lessonId: lessonIds[0]!, streamId, grade: 90, gradedAt: new Date() },
  });
  await kit.prisma.submission.create({
    data: { studentId: anna, lessonId: lessonIds[1]!, streamId, grade: 80, gradedAt: new Date() },
  });
  await kit.prisma.submission.create({
    data: { studentId: bohdan, lessonId: lessonIds[0]!, streamId },
  });
});

const get = (path: string, cookie?: string) => {
  const req = request(kit.app).get(`/api${path}`);
  return cookie ? req.set('Cookie', cookie) : req;
};

describe('адмінські довідники та звіт за потоком (ФВ-16)', () => {
  it.each(['/admin/teachers', '/admin/streams', '/admin/streams/1/report'])(
    '%s: без сесії 401, студент і викладач 403',
    async (path) => {
      expect((await get(path)).status).toBe(401);
      expect((await get(path, student)).status).toBe(403);
      expect((await get(path, teacher)).status).toBe(403);
    },
  );

  it('список викладачів містить лише викладачів', async () => {
    const res = await get('/admin/teachers', admin);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { id: teacherId, name: 'User teacher', email: 't@example.com' },
    ]);
  });

  it('список потоків показує курс і зайняті місця', async () => {
    const res = await get('/admin/streams', admin);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: streamId,
      capacity: 10,
      seatsTaken: 2,
      course: { id: courseId, title: 'Курс' },
    });
  });

  it('звіт: підсумки й рядки студентів збігаються з даними', async () => {
    const res = await get(`/admin/streams/${streamId}/report`, admin);
    expect(res.status).toBe(200);
    expect(res.body.stream).toMatchObject({
      id: streamId,
      seatsTaken: 2,
      course: { id: courseId, title: 'Курс' },
      teacher: { id: teacherId, name: 'User teacher' },
    });
    expect(res.body.summary).toEqual({
      students: 2,
      finished: 1,
      averageProgress: 63,
      homeworkSubmitted: 3,
      homeworkGraded: 2,
      averageGrade: 85,
    });
    const byName = new Map<string, any>(res.body.students.map((s: any) => [s.email, s]));
    expect(byName.get('anna@example.com')).toMatchObject({
      progress: { completed: 4, total: 4, percent: 100 },
      homework: { total: 2, submitted: 2, graded: 2 },
      averageGrade: 85,
    });
    expect(byName.get('bohdan@example.com')).toMatchObject({
      progress: { completed: 1, total: 4, percent: 25 },
      homework: { total: 2, submitted: 1, graded: 0 },
      averageGrade: null,
    });
  });

  it('потік без студентів: нулі й averageGrade = null', async () => {
    const empty = await kit.createStream(courseId, 5);
    const res = await get(`/admin/streams/${empty}/report`, admin);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      students: 0,
      finished: 0,
      averageProgress: 0,
      homeworkSubmitted: 0,
      homeworkGraded: 0,
      averageGrade: null,
    });
    expect(res.body.students).toEqual([]);
  });

  it('неіснуючий потік → 404, некоректний id → 400', async () => {
    expect((await get('/admin/streams/99999/report', admin)).status).toBe(404);
    expect((await get('/admin/streams/abc/report', admin)).status).toBe(400);
  });
});
