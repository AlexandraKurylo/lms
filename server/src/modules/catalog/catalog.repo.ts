import type { Queryable } from '../../shared/db.js';

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  level: string;
  language: string;
  teacher: { id: number; name: string } | null;
  topics: string[];
  lessonCount: number;
}

export interface CourseFilters {
  topic?: number | undefined;
  level?: string | undefined;
  language?: string | undefined;
  q?: string | undefined;
  /** Ключ сортування останнього рядка попередньої сторінки. */
  after?: { title: string; id: number } | undefined;
  limit: number;
}

/** Екранує спецсимволи LIKE, щоб пошук «50%» шукав саме «50%», а не будь-що. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function createCatalogRepo(db: Queryable) {
  return {
    async listTopics(): Promise<{ id: number; name: string }[]> {
      const { rows } = await db.query<{ id: number; name: string }>(
        'SELECT id, name FROM topics ORDER BY name',
      );
      return rows;
    },

    /**
     * Каталог опублікованих курсів, відсортований за (title, id).
     * Умови додаються лише ті, що задані, тому планувальник не мучиться з «$1 IS NULL OR …»,
     * а курсорна умова `(title, id) > (…)` збігається з індексом courses_catalog_idx.
     * Повертає до limit + 1 рядків: зайвий лише показує, що є наступна сторінка.
     */
    async listPublished(filters: CourseFilters): Promise<CourseSummary[]> {
      const where: string[] = [`c.status = 'published'`];
      const params: unknown[] = [];
      const add = (value: unknown): string => {
        params.push(value);
        return `$${params.length}`;
      };

      if (filters.topic !== undefined) {
        where.push(
          `EXISTS (SELECT 1 FROM course_topics ct WHERE ct.course_id = c.id AND ct.topic_id = ${add(filters.topic)})`,
        );
      }
      if (filters.level !== undefined) where.push(`c.level = ${add(filters.level)}`);
      if (filters.language !== undefined) where.push(`c.language = ${add(filters.language)}`);
      if (filters.q !== undefined) {
        const p = add(`%${escapeLike(filters.q)}%`);
        where.push(`(c.title ILIKE ${p} OR c.description ILIKE ${p})`);
      }
      if (filters.after) {
        where.push(`(c.title, c.id) > (${add(filters.after.title)}, ${add(filters.after.id)})`);
      }
      const limit = add(filters.limit + 1);

      const { rows } = await db.query<{
        id: number;
        title: string;
        description: string;
        level: string;
        language: string;
        teacher_id: number | null;
        teacher_name: string | null;
        topics: string[];
        lesson_count: number;
      }>(
        `SELECT c.id, c.title, c.description, c.level, c.language,
                u.id AS teacher_id, u.name AS teacher_name,
                COALESCE((SELECT json_agg(t.name ORDER BY t.name)
                            FROM course_topics ct JOIN topics t ON t.id = ct.topic_id
                           WHERE ct.course_id = c.id), '[]'::json) AS topics,
                (SELECT count(*)::int FROM lessons l WHERE l.course_id = c.id) AS lesson_count
           FROM courses c
           LEFT JOIN users u ON u.id = c.teacher_id
          WHERE ${where.join(' AND ')}
          ORDER BY c.title, c.id
          LIMIT ${limit}`,
        params,
      );

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        level: r.level,
        language: r.language,
        teacher: r.teacher_id === null ? null : { id: r.teacher_id, name: r.teacher_name! },
        topics: r.topics,
        lessonCount: r.lesson_count,
      }));
    },
  };
}

export type CatalogRepo = ReturnType<typeof createCatalogRepo>;
