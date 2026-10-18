import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, writeSeed } from '../src/db/seed.js';
import type { AuthUser } from '../src/modules/auth/auth.types.js';
import { createCatalogRepo } from '../src/modules/catalog/catalog.repo.js';
import { courseIdParamsSchema } from '../src/modules/catalog/catalog.schemas.js';
import { createCatalogService } from '../src/modules/catalog/catalog.service.js';
import pg from 'pg';
import { createPrisma } from '../src/shared/db.js';
import { DomainError } from '../src/shared/errors.js';
import { resetTestDatabase } from './helpers/testDb.js';

const seed = buildSeed('hash');
const published = seed.courses.find((c) => c.status === 'published')!;
const draft = seed.courses.find((c) => c.status === 'draft')!;

const asUser = (id: number, role: AuthUser['role']): AuthUser => ({
  id,
  role,
  email: `u${id}@example.com`,
  name: `User ${id}`,
});

const { Pool } = pg;
let pool: pg.Pool;
let prisma: ReturnType<typeof createPrisma>;
let service: ReturnType<typeof createCatalogService>;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof DomainError ? err.code : 'other';
  }
}

beforeAll(async () => {
  const url = await resetTestDatabase();
  await writeSeed(url, seed);
  pool = new Pool({ connectionString: url });
  prisma = createPrisma(url);
  service = createCatalogService({ repo: createCatalogRepo(prisma) });
});
afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});

describe('сторінка курсу', () => {
  it('гість бачить опублікований курс: викладача, теми, зміст і потоки', async () => {
    const page = await service.getCoursePage(published.id, undefined);
    expect(page.title).toBe(published.title);
    expect(page.teacher?.id).toBe(published.teacherId);
    expect(page.topics.length).toBeGreaterThan(0);
    expect(page.lessons).toHaveLength(
      seed.lessons.filter((l) => l.courseId === published.id).length,
    );
    expect(page.streams.length).toBeGreaterThanOrEqual(2);
  });

  it('зміст відсортований за position і не містить тексту уроків', async () => {
    const page = await service.getCoursePage(published.id, undefined);
    const positions = page.lessons.map((l) => l.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(page.lessons[0]!.isFreeIntro).toBe(true);
    expect(page.lessons.every((l) => !('content' in l))).toBe(true);
  });

  it('вільні місця обчислюються із записів: зайняті = active + completed', async () => {
    const page = await service.getCoursePage(published.id, undefined);
    for (const stream of page.streams) {
      const taken = seed.enrollments.filter(
        (e) => e.streamId === stream.id && e.status !== 'cancelled',
      ).length;
      expect(stream.seatsTaken).toBe(taken);
      expect(stream.seatsLeft).toBe(stream.capacity - taken);
    }
  });

  it('скасований запис звільняє місце', async () => {
    const stream = (await service.getCoursePage(published.id, undefined)).streams[0]!;
    const { rows } = await pool.query<{ id: number }>(
      `SELECT id FROM enrollments WHERE stream_id = $1 AND status = 'active' LIMIT 1`,
      [stream.id],
    );
    if (rows.length === 0) return; // у цього потоку немає активних записів — нічого перевіряти
    await pool.query(`UPDATE enrollments SET status = 'cancelled' WHERE id = $1`, [rows[0]!.id]);
    const after = (await service.getCoursePage(published.id, undefined)).streams[0]!;
    expect(after.seatsLeft).toBe(stream.seatsLeft + 1);
  });

  it('неіснуючий курс — 404', async () => {
    expect(await codeOf(service.getCoursePage(999_999, undefined))).toBe('not-found');
  });
});

describe('видимість чернетки', () => {
  const owner = () => asUser(draft.teacherId, 'teacher');

  it('гість, студент і чужий викладач отримують 404, а не 403', async () => {
    for (const viewer of [
      undefined,
      asUser(500, 'student'),
      asUser(draft.teacherId + 1, 'teacher'),
    ]) {
      expect(await codeOf(service.getCoursePage(draft.id, viewer))).toBe('not-found');
      expect(await codeOf(service.getIntroLesson(draft.id, viewer))).toBe('not-found');
    }
  });

  it('викладач-власник і адміністратор бачать чернетку', async () => {
    expect((await service.getCoursePage(draft.id, owner())).status).toBe('draft');
    expect((await service.getCoursePage(draft.id, asUser(1, 'admin'))).status).toBe('draft');
  });
});

describe('безкоштовний вступний урок', () => {
  it('доступний гостю разом із матеріалами', async () => {
    const lesson = await service.getIntroLesson(published.id, undefined);
    const source = seed.lessons.find((l) => l.courseId === published.id && l.freeIntro)!;
    expect(lesson.id).toBe(source.id);
    expect(lesson.content).toBe(source.content);
    expect(lesson.materials.length).toBeGreaterThan(0);
  });

  it('якщо вступного уроку немає — 404', async () => {
    await pool.query('UPDATE lessons SET is_free_intro = false WHERE course_id = $1', [
      published.id,
    ]);
    expect(await codeOf(service.getIntroLesson(published.id, undefined))).toBe('not-found');
  });
});

describe('параметр шляху', () => {
  it('приймає додатне ціле, відхиляє сміття', () => {
    expect(courseIdParamsSchema.parse({ id: '12' }).id).toBe(12);
    for (const id of ['abc', '-1', '0', '1.5']) {
      expect(courseIdParamsSchema.safeParse({ id }).success).toBe(false);
    }
  });
});
