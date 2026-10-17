import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED_COUNTS, buildSeed, writeSeed } from '../src/db/seed.js';
import { resetTestDatabase, testDatabaseUrl } from './helpers/testDb.js';

const { Pool } = pg;

describe('buildSeed (без бази)', () => {
  const data = buildSeed('hash');

  it('дає обсяги з технічного завдання', () => {
    expect(data.courses).toHaveLength(40);
    expect(data.streams).toHaveLength(SEED_COUNTS.streams);
    expect(data.lessons).toHaveLength(SEED_COUNTS.lessons);
    expect(data.enrollments).toHaveLength(SEED_COUNTS.enrollments);
    expect(data.users.filter((u) => u.role === 'student')).toHaveLength(SEED_COUNTS.students);
    expect(data.users.filter((u) => u.role === 'teacher')).toHaveLength(SEED_COUNTS.teachers);
    expect(data.users.filter((u) => u.role === 'admin')).toHaveLength(1);
  });

  it('детермінований: однаковий seed дає однакові дані', () => {
    expect(buildSeed('hash')).toEqual(data);
    expect(buildSeed('hash', 7)).not.toEqual(data);
  });

  it('жоден потік не переповнений, є повні потоки й потік з одним вільним місцем', () => {
    const occupied = new Map<number, number>();
    for (const e of data.enrollments) {
      if (e.status !== 'cancelled') occupied.set(e.streamId, (occupied.get(e.streamId) ?? 0) + 1);
    }
    const free = data.streams.map((s) => s.capacity - (occupied.get(s.id) ?? 0));
    expect(Math.min(...free)).toBeGreaterThanOrEqual(0);
    expect(free.filter((f) => f === 0).length).toBeGreaterThanOrEqual(3);
    expect(free.filter((f) => f === 1).length).toBeGreaterThanOrEqual(1);
  });

  it('студент не має двох зайнятих записів на один курс', () => {
    const seen = new Set<string>();
    for (const e of data.enrollments.filter((x) => x.status !== 'cancelled')) {
      const key = `${e.studentId}:${e.courseId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('позначки про прогрес належать урокам курсу, на який студент записаний', () => {
    const courseOfLesson = new Map(data.lessons.map((l) => [l.id, l.courseId]));
    const coursesOfStudent = new Map<number, Set<number>>();
    for (const e of data.enrollments) {
      const set = coursesOfStudent.get(e.studentId) ?? new Set<number>();
      set.add(e.courseId);
      coursesOfStudent.set(e.studentId, set);
    }
    for (const p of data.progress) {
      expect(coursesOfStudent.get(p.studentId)?.has(courseOfLesson.get(p.lessonId)!)).toBe(true);
    }
  });
});

describe('writeSeed (реальна PostgreSQL)', () => {
  let pool: InstanceType<typeof Pool>;

  beforeAll(async () => {
    const url = await resetTestDatabase();
    await writeSeed(url, buildSeed('hash'));
    pool = new Pool({ connectionString: url });
  });
  afterAll(async () => {
    await pool.end();
  });

  async function count(table: string, where = 'true'): Promise<number> {
    const r = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`,
    );
    return r.rows[0]!.n;
  }

  it('записує всі обсяги', async () => {
    expect(await count('courses')).toBe(40);
    expect(await count('streams')).toBe(80);
    expect(await count('lessons')).toBe(500);
    expect(await count('enrollments')).toBe(800);
    expect(await count('users', `role = 'student'`)).toBe(200);
  });

  it('у кожному курсі рівно один безкоштовний вступний урок', async () => {
    expect(await count('lessons', 'is_free_intro')).toBe(40);
  });

  it('після сиду нові рядки отримують коректні id (послідовності зсунуті)', async () => {
    const r = await pool.query<{ id: number }>(
      `INSERT INTO topics (name) VALUES ('Нова тема') RETURNING id`,
    );
    expect(r.rows[0]!.id).toBe(13);
  });

  it('повторний запуск сиду не дублює дані', async () => {
    const url = testDatabaseUrl();
    await writeSeed(url, buildSeed('hash'));
    expect(await count('courses')).toBe(40);
    expect(await count('enrollments')).toBe(800);
  });
});
