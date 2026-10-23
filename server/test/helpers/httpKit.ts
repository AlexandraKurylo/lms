import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { createPrisma } from '../../src/shared/db.js';
import { createLogger } from '../../src/shared/logger.js';
import { resetTestDatabase } from './testDb.js';

export const PASSWORD = 'Passw0rd!';
const hasher = {
  hash: (p: string) => bcrypt.hash(p, 4),
  compare: (p: string, h: string) => bcrypt.compare(p, h),
};

export async function startKit() {
  const url = await resetTestDatabase();
  const pool = new pg.Pool({ connectionString: url, max: 20 });
  const prisma = createPrisma(url);
  const app = createApp({
    logger: createLogger('silent'),
    db: prisma,
    jwtSecret: process.env.JWT_SECRET!,
    cookieSecure: false,
    hasher,
  });
  async function createUser(email: string, role: 'student' | 'teacher' | 'admin'): Promise<number> {
    const user = await prisma.user.create({
      data: { email, name: `User ${role}`, role, passwordHash: await hasher.hash(PASSWORD) },
    });
    return user.id;
  }
  async function loginAs(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    return cookies.find((c) => c.startsWith('lms_session='))!.split(';')[0]!;
  }
  async function createCourse(teacherId: number, status: 'draft' | 'published' = 'published') {
    const { rows } = await pool.query(
      `INSERT INTO courses(title, description, teacher_id, status) VALUES ('Курс', 'Опис', $1, $2) RETURNING id`,
      [teacherId, status],
    );
    return rows[0].id as number;
  }
  async function createStream(courseId: number, capacity: number, endsOn = '2099-12-31') {
    const { rows } = await pool.query(
      `INSERT INTO streams(course_id, title, starts_on, ends_on, capacity)
       VALUES ($1, 'Потік', LEAST('2030-01-01'::date, $2::date), $2::date, $3) RETURNING id`,
      [courseId, endsOn, capacity],
    );
    return rows[0].id as number;
  }
  async function stop() {
    await pool.end();
    await prisma.$disconnect();
  }
  return { app, pool, prisma, createUser, loginAs, createCourse, createStream, stop };
}