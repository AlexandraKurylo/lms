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

export interface CourseRecord {
  id: number;
  title: string;
  description: string;
  level: string;
  language: string;
  status: 'draft' | 'published';
  sequentialLessons: boolean;
  teacherId: number | null;
  teacher: { id: number; name: string; bio: string | null } | null;
}

export interface LessonOutline {
  id: number;
  position: number;
  title: string;
  isFreeIntro: boolean;
  hasHomework: boolean;
}

export interface StreamInfo {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  phase: 'upcoming' | 'running' | 'finished';
}

export interface IntroLesson {
  id: number;
  position: number;
  title: string;
  content: string;
  materials: { id: number; title: string; kind: string; url: string }[];
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

    async findCourse(id: number): Promise<CourseRecord | null> {
      const { rows } = await db.query<{
        id: number;
        title: string;
        description: string;
        level: string;
        language: string;
        status: 'draft' | 'published';
        sequential_lessons: boolean;
        teacher_id: number | null;
        teacher_name: string | null;
        teacher_bio: string | null;
      }>(
        `SELECT c.id, c.title, c.description, c.level, c.language, c.status, c.sequential_lessons,
                c.teacher_id, u.name AS teacher_name, u.bio AS teacher_bio
           FROM courses c LEFT JOIN users u ON u.id = c.teacher_id
          WHERE c.id = $1`,
        [id],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        level: r.level,
        language: r.language,
        status: r.status,
        sequentialLessons: r.sequential_lessons,
        teacherId: r.teacher_id,
        teacher:
          r.teacher_id === null
            ? null
            : { id: r.teacher_id, name: r.teacher_name!, bio: r.teacher_bio },
      };
    },

    async topicsOfCourse(courseId: number): Promise<{ id: number; name: string }[]> {
      const { rows } = await db.query<{ id: number; name: string }>(
        `SELECT t.id, t.name FROM course_topics ct JOIN topics t ON t.id = ct.topic_id
          WHERE ct.course_id = $1 ORDER BY t.name`,
        [courseId],
      );
      return rows;
    },

    /** Структура курсу без вмісту уроків: зміст видно всім, відкриваються уроки окремо. */
    async lessonOutline(courseId: number): Promise<LessonOutline[]> {
      const { rows } = await db.query<{
        id: number;
        position: number;
        title: string;
        is_free_intro: boolean;
        has_homework: boolean;
      }>(
        `SELECT id, position, title, is_free_intro, has_homework
           FROM lessons WHERE course_id = $1 ORDER BY position`,
        [courseId],
      );
      return rows.map((r) => ({
        id: r.id,
        position: r.position,
        title: r.title,
        isFreeIntro: r.is_free_intro,
        hasHomework: r.has_homework,
      }));
    },

    /** Потоки з обчисленими вільними місцями: зайняті місця рахуються із записів, а не зберігаються. */
    async streamsOfCourse(courseId: number): Promise<StreamInfo[]> {
      const { rows } = await db.query<{
        id: number;
        title: string;
        starts_on: string;
        ends_on: string;
        capacity: number;
        seats_taken: number;
        phase: StreamInfo['phase'];
      }>(
        `SELECT s.id, s.title, to_char(s.starts_on, 'YYYY-MM-DD') AS starts_on,
                to_char(s.ends_on, 'YYYY-MM-DD') AS ends_on, s.capacity,
                (SELECT count(*)::int FROM enrollments e
                  WHERE e.stream_id = s.id AND e.status IN ('active', 'completed')) AS seats_taken,
                CASE WHEN s.ends_on < current_date THEN 'finished'
                     WHEN s.starts_on > current_date THEN 'upcoming'
                     ELSE 'running' END AS phase
           FROM streams s WHERE s.course_id = $1 ORDER BY s.starts_on, s.id`,
        [courseId],
      );
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        capacity: r.capacity,
        seatsTaken: r.seats_taken,
        seatsLeft: Math.max(r.capacity - r.seats_taken, 0),
        phase: r.phase,
      }));
    },

    async findIntroLesson(courseId: number): Promise<IntroLesson | null> {
      const lesson = await db.query<{
        id: number;
        position: number;
        title: string;
        content: string;
      }>(
        `SELECT id, position, title, content FROM lessons WHERE course_id = $1 AND is_free_intro`,
        [courseId],
      );
      const row = lesson.rows[0];
      if (!row) return null;
      const materials = await db.query<{ id: number; title: string; kind: string; url: string }>(
        'SELECT id, title, kind, url FROM materials WHERE lesson_id = $1 ORDER BY id',
        [row.id],
      );
      return { ...row, materials: materials.rows };
    },
  };
}

export type CatalogRepo = ReturnType<typeof createCatalogRepo>;
