import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startKit } from './helpers/httpKit.js';

let kit: Awaited<ReturnType<typeof startKit>>;
let teacherA: string;
let teacherB: string;
let student: string;
let courseA: number;

beforeAll(async () => {
  kit = await startKit();
});
afterAll(async () => {
  await kit.stop();
});
beforeEach(async () => {
  await kit.pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  const a = await kit.createUser('a@example.com', 'teacher');
  await kit.createUser('b@example.com', 'teacher');
  await kit.createUser('s@example.com', 'student');
  teacherA = await kit.loginAs('a@example.com');
  teacherB = await kit.loginAs('b@example.com');
  student = await kit.loginAs('s@example.com');
  courseA = await kit.createCourse(a, 'draft');
});

const body = { title: 'Осінь 2030', startsOn: '2030-09-01', endsOn: '2030-12-20', capacity: 20 };
const create = (cookie: string, data: object = body, course = courseA) =>
  request(kit.app).post(`/api/teacher/courses/${course}/streams`).set('Cookie', cookie).send(data);

describe('потоки в кабінеті викладача', () => {
  it('студент → 403, без сесії → 401', async () => {
    expect((await create(student)).status).toBe(403);
    expect((await request(kit.app).get(`/api/teacher/courses/${courseA}/streams`)).status).toBe(
      401,
    );
  });

  it('викладач створює потік і бачить його у списку з seatsTaken = 0', async () => {
    const res = await create(teacherA);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ capacity: 20, seatsTaken: 0, courseId: courseA });
    const list = await request(kit.app)
      .get(`/api/teacher/courses/${courseA}/streams`)
      .set('Cookie', teacherA);
    expect(list.body.items).toHaveLength(1);
  });

  it('чужий курс і чужий потік → 404', async () => {
    const own = await create(teacherA);
    expect((await create(teacherB)).status).toBe(404);
    const foreign = await request(kit.app)
      .patch(`/api/teacher/streams/${own.body.id}`)
      .set('Cookie', teacherB)
      .send({ capacity: 5 });
    expect(foreign.status).toBe(404);
  });

  it('валідація: кінець раніше початку, нульова місткість, зайве поле → 400', async () => {
    expect((await create(teacherA, { ...body, endsOn: '2030-08-01' })).status).toBe(400);
    expect((await create(teacherA, { ...body, capacity: 0 })).status).toBe(400);
    expect((await create(teacherA, { ...body, seatsTaken: 5 })).status).toBe(400);
  });

  it('PATCH не дозволяє зменшити capacity нижче за зайняті місця → 409', async () => {
    const stream = (await create(teacherA)).body.id as number;
    await kit.pool.query(`UPDATE courses SET status = 'published' WHERE id = $1`, [courseA]);
    await kit.createUser('s2@example.com', 'student');
    for (const email of ['s@example.com', 's2@example.com']) {
      await kit.pool.query(
        `INSERT INTO enrollments(student_id, stream_id, course_id)
         SELECT u.id, $1, $2 FROM users u WHERE u.email = $3`,
        [stream, courseA, email],
      );
    }
    const low = await request(kit.app)
      .patch(`/api/teacher/streams/${stream}`)
      .set('Cookie', teacherA)
      .send({ capacity: 1 });
    expect(low.status).toBe(409);
    const ok = await request(kit.app)
      .patch(`/api/teacher/streams/${stream}`)
      .set('Cookie', teacherA)
      .send({ capacity: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.seatsTaken).toBe(2);
  });
});
