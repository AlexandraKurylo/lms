import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, writeSeed } from '../src/db/seed.js';
import { createCatalogRepo, escapeLike } from '../src/modules/catalog/catalog.repo.js';
import { listCoursesQuerySchema } from '../src/modules/catalog/catalog.schemas.js';
import { createCatalogService } from '../src/modules/catalog/catalog.service.js';
import pg from 'pg';
import { createPrisma } from '../src/shared/db.js';
import { DomainError } from '../src/shared/errors.js';
import { encodeCursor } from '../src/shared/pagination.js';
import { parseWith } from '../src/shared/validate.js';
import { resetTestDatabase } from './helpers/testDb.js';

const seed = buildSeed('hash');
const published = seed.courses.filter((c) => c.status === 'published');

const { Pool } = pg;
let pool: pg.Pool;
let prisma: ReturnType<typeof createPrisma>;
let service: ReturnType<typeof createCatalogService>;

const query = (raw: Record<string, unknown> = {}) =>
  parseWith(listCoursesQuerySchema, raw, 'query');

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

describe('каталог курсів', () => {
  it('показує лише опубліковані курси, без чернеток', async () => {
    const page = await service.listCourses(query({ limit: 100 }));
    expect(page.items).toHaveLength(published.length);
    expect(page.nextCursor).toBeNull();
    const draftTitles = new Set(
      seed.courses.filter((c) => c.status === 'draft').map((c) => c.title),
    );
    expect(page.items.some((c) => draftTitles.has(c.title))).toBe(false);
  });

  it('повертає викладача, теми й кількість уроків', async () => {
    const page = await service.listCourses(query({ limit: 100 }));
    const first = page.items[0]!;
    const source = published.find((c) => c.id === first.id)!;
    expect(first.teacher?.id).toBe(source.teacherId);
    expect(first.lessonCount).toBe(seed.lessons.filter((l) => l.courseId === first.id).length);
    expect(first.topics.length).toBeGreaterThan(0);
  });

  it('пагінація проходить усі сторінки без повторів і пропусків, у порядку (title, id)', async () => {
    const ids: number[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await service.listCourses(query({ limit: 7, ...(cursor ? { cursor } : {}) }));
      ids.push(...page.items.map((c) => c.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor);
    expect(pages).toBe(Math.ceil(published.length / 7));
    expect(new Set(ids).size).toBe(published.length);
    // еталонний порядок дає сама база: ORDER BY title, id (collation береться з БД)
    const expected = await pool.query<{ id: number }>(
      `SELECT id FROM courses WHERE status = 'published' ORDER BY title, id`,
    );
    expect(ids).toEqual(expected.rows.map((r) => r.id));
  });

  it('фільтр за рівнем і мовою працює на сервері та комбінується', async () => {
    const page = await service.listCourses(
      query({ level: 'advanced', language: 'en', limit: 100 }),
    );
    const expected = published.filter((c) => c.level === 'advanced' && c.language === 'en');
    expect(page.items.map((c) => c.id).sort()).toEqual(expected.map((c) => c.id).sort());
    expect(page.items.length).toBeGreaterThan(0);
  });

  it('фільтр за темою повертає лише курси цієї теми', async () => {
    const topic = seed.topics.find((t) => t.name === 'DevOps')!;
    const page = await service.listCourses(query({ topic: topic.id, limit: 100 }));
    const expectedIds = new Set(
      seed.courseTopics.filter((x) => x.topicId === topic.id).map((x) => x.courseId),
    );
    const expected = published.filter((c) => expectedIds.has(c.id));
    expect(page.items.map((c) => c.id).sort()).toEqual(expected.map((c) => c.id).sort());
    expect(page.items.every((c) => c.topics.includes('DevOps'))).toBe(true);
  });

  it('пошук за назвою не залежить від регістру, а % і _ шукаються буквально', async () => {
    const hit = await service.listCourses(query({ q: 'PYTHON', limit: 100 }));
    expect(hit.items.length).toBeGreaterThan(0);
    expect(hit.items.every((c) => /python/i.test(c.title + c.description))).toBe(true);
    const wildcard = await service.listCourses(query({ q: '%', limit: 100 }));
    expect(wildcard.items).toHaveLength(0);
  });

  it('порожній результат фільтра — це порожня сторінка, а не помилка', async () => {
    const page = await service.listCourses(query({ language: 'de' }));
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('зіпсований курсор — помилка валідації (400), а не 500', async () => {
    const bad = [
      'definitely-not-a-cursor',
      encodeCursor(['title-only']),
      encodeCursor([1, 'swapped']),
      encodeCursor(['title', 1.5]),
    ];
    for (const cursor of bad) {
      const err = await service.listCourses(query({ cursor })).catch((e: unknown) => e);
      expect(err instanceof DomainError && err.code).toBe('validation');
    }
  });
});

describe('схема запиту', () => {
  it('limit має межі та значення за замовчуванням', () => {
    expect(query().limit).toBe(20);
    expect(listCoursesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listCoursesQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('відхиляє невідомий рівень і некоректний код мови', () => {
    expect(listCoursesQuerySchema.safeParse({ level: 'expert' }).success).toBe(false);
    expect(listCoursesQuerySchema.safeParse({ language: 'ukr' }).success).toBe(false);
  });

  it('escapeLike екранує спецсимволи', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
