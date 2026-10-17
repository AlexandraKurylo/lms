import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../src/db/migrate.js';
import { resetTestDatabase } from './helpers/testDb.js';

const { Pool } = pg;

let pool: InstanceType<typeof Pool>;
let url: string;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
}

beforeAll(async () => {
  url = await resetTestDatabase();
  pool = new Pool({ connectionString: url });
  await pool.query(`INSERT INTO users (email, password_hash, name, role) VALUES
    ('t@x.com', 'h', 'Teacher', 'teacher'), ('s1@x.com', 'h', 'Student 1', 'student'),
    ('s2@x.com', 'h', 'Student 2', 'student')`);
  await pool.query(
    `INSERT INTO courses (title, teacher_id, status) VALUES ('Курс A', 1, 'published'), ('Курс B', 1, 'published')`,
  );
  await pool.query(`INSERT INTO streams (course_id, title, starts_on, ends_on, capacity) VALUES
    (1, 'A1', '2026-11-01', '2026-12-01', 5), (1, 'A2', '2026-12-10', '2027-01-10', 5), (2, 'B1', '2026-11-01', '2026-12-01', 5)`);
});

afterAll(async () => {
  await pool.end();
});

describe('схема бази даних', () => {
  it('міграції застосовуються з нуля, а повторний запуск нічого не змінює', async () => {
    expect(await runMigrations({ connectionString: url })).toEqual([]);
  });

  it('email унікальний без урахування регістру', async () => {
    const code = await codeOf(
      pool.query(`INSERT INTO users (email, password_hash, name) VALUES ('S1@X.com', 'h', 'Dup')`),
    );
    expect(code).toBe('23505');
  });

  it('студент не може записатися двічі на один курс (навіть на різні потоки)', async () => {
    await pool.query(`INSERT INTO enrollments (student_id, stream_id, course_id) VALUES (2, 1, 1)`);
    const code = await codeOf(
      pool.query(`INSERT INTO enrollments (student_id, stream_id, course_id) VALUES (2, 2, 1)`),
    );
    expect(code).toBe('23505');
  });

  it('після скасування запису можна записатися знову', async () => {
    await pool.query(
      `UPDATE enrollments SET status = 'cancelled' WHERE student_id = 2 AND stream_id = 1`,
    );
    await pool.query(`INSERT INTO enrollments (student_id, stream_id, course_id) VALUES (2, 2, 1)`);
  });

  it('course_id запису має збігатися з курсом потоку', async () => {
    const code = await codeOf(
      pool.query(`INSERT INTO enrollments (student_id, stream_id, course_id) VALUES (3, 3, 1)`),
    );
    expect(code).toBe('23503');
  });

  it('у курсі лише один безкоштовний вступний урок', async () => {
    await pool.query(
      `INSERT INTO lessons (course_id, position, title, is_free_intro) VALUES (1, 1, 'Вступ', true)`,
    );
    const code = await codeOf(
      pool.query(
        `INSERT INTO lessons (course_id, position, title, is_free_intro) VALUES (1, 2, 'Ще вступ', true)`,
      ),
    );
    expect(code).toBe('23505');
  });

  it('позиція уроку унікальна в межах курсу, але уроки можна поміняти місцями в транзакції', async () => {
    await pool.query(`INSERT INTO lessons (course_id, position, title) VALUES (1, 2, 'Другий')`);
    const dup = await codeOf(
      pool.query(`INSERT INTO lessons (course_id, position, title) VALUES (1, 2, 'Дубль')`),
    );
    expect(dup).toBe('23505');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE lessons SET position = 2 WHERE course_id = 1 AND title = 'Вступ'`);
      await client.query(
        `UPDATE lessons SET position = 1 WHERE course_id = 1 AND title = 'Другий'`,
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const order = await pool.query(
      `SELECT title FROM lessons WHERE course_id = 1 ORDER BY position`,
    );
    expect(order.rows.map((r) => r.title)).toEqual(['Другий', 'Вступ']);
  });

  it('оцінка від 0 до 100 і разом із датою оцінювання', async () => {
    const lesson = await pool.query(`SELECT id FROM lessons WHERE course_id = 1 LIMIT 1`);
    const lessonId = lesson.rows[0].id;
    const bad = await codeOf(
      pool.query(
        `INSERT INTO submissions (student_id, lesson_id, stream_id, grade, graded_at) VALUES (2, $1, 2, 150, now())`,
        [lessonId],
      ),
    );
    expect(bad).toBe('23514');
    const noDate = await codeOf(
      pool.query(
        `INSERT INTO submissions (student_id, lesson_id, stream_id, grade) VALUES (2, $1, 2, 90)`,
        [lessonId],
      ),
    );
    expect(noDate).toBe('23514');
  });
});
