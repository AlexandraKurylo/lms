import { materialSelect, toMaterialView, type MaterialView } from '../materials/materials.view.js';
import { Prisma, type Db } from '../../shared/db.js';

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
  materials: MaterialView[];
}

/** Екранує спецсимволи LIKE, щоб пошук «50%» шукав саме «50%», а не будь-що. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function createCatalogRepo(db: Db) {
  return {
    async listTopics(): Promise<{ id: number; name: string }[]> {
      return db.topic.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
    },

    /**
     * Каталог опублікованих курсів, відсортований за (title, id).
     * Спершу сирим SQL вибираються id однієї сторінки: курсор записано як порівняння рядків
     * (title, id) > (...), і PostgreSQL бере його як умову індексу courses_catalog_idx,
     * тому глибока сторінка читає стільки ж рядків, що й перша (docs/perf/catalog-explain.md).
     * Умова з OR, яку будує Prisma, так не працює: індекс проходиться з початку.
     * Потім Prisma довантажує курси пачкою разом із зв'язаними даними (немає N+1).
     * Повертає до limit + 1 рядків: зайвий лише показує, що є наступна сторінка.
     */
    async listPublished(filters: CourseFilters): Promise<CourseSummary[]> {
      const conditions: Prisma.Sql[] = [Prisma.sql`c.status = 'published'`];

      // EXISTS: курс із двома темами не дублюється у видачі
      if (filters.topic !== undefined) {
        conditions.push(
          Prisma.sql`EXISTS (SELECT 1 FROM course_topics ct WHERE ct.course_id = c.id AND ct.topic_id = ${filters.topic})`,
        );
      }
      if (filters.level !== undefined) {
        conditions.push(Prisma.sql`c.level = ${filters.level}::course_level`);
      }
      if (filters.language !== undefined) {
        conditions.push(Prisma.sql`c.language = ${filters.language}`);
      }
      if (filters.q !== undefined) {
        const pattern = `%${escapeLike(filters.q)}%`;
        conditions.push(Prisma.sql`(c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})`);
      }
      if (filters.after) {
        conditions.push(
          Prisma.sql`(c.title, c.id) > (${filters.after.title}, ${filters.after.id})`,
        );
      }

      const page = await db.$queryRaw<{ id: number }[]>`
        SELECT c.id
        FROM courses c
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY c.title, c.id
        LIMIT ${filters.limit + 1}`;
      if (page.length === 0) return [];

      const rows = await db.course.findMany({
        where: { id: { in: page.map((row) => row.id) } },
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          language: true,
          teacher: { select: { id: true, name: true } },
          topics: {
            orderBy: { topic: { name: 'asc' } },
            select: { topic: { select: { name: true } } },
          },
          _count: { select: { lessons: true } },
        },
      });

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        level: r.level,
        language: r.language,
        teacher: r.teacher,
        topics: r.topics.map((t) => t.topic.name),
        lessonCount: r._count.lessons,
      }));
    },

    async findCourse(id: number): Promise<CourseRecord | null> {
      const r = await db.course.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          language: true,
          status: true,
          sequentialLessons: true,
          teacherId: true,
          teacher: { select: { id: true, name: true, bio: true } },
        },
      });
      return r;
    },

    async topicsOfCourse(courseId: number): Promise<{ id: number; name: string }[]> {
      return db.topic.findMany({
        where: { courses: { some: { courseId } } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
    },

    /** Структура курсу без вмісту уроків: зміст видно всім, відкриваються уроки окремо. */
    async lessonOutline(courseId: number): Promise<LessonOutline[]> {
      return db.lesson.findMany({
        where: { courseId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true, title: true, isFreeIntro: true, hasHomework: true },
      });
    },

    /** Потоки з обчисленими вільними місцями: зайняті місця рахуються із записів, а не зберігаються. */
    async streamsOfCourse(courseId: number): Promise<StreamInfo[]> {
      const rows = await db.stream.findMany({
        where: { courseId },
        orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          startsOn: true,
          endsOn: true,
          capacity: true,
          _count: {
            select: { enrollments: { where: { status: { in: ['active', 'completed'] } } } },
          },
        },
      });
      const today = new Date().toISOString().slice(0, 10);
      return rows.map((r) => {
        const startsOn = r.startsOn.toISOString().slice(0, 10);
        const endsOn = r.endsOn.toISOString().slice(0, 10);
        const seatsTaken = r._count.enrollments;
        return {
          id: r.id,
          title: r.title,
          startsOn,
          endsOn,
          capacity: r.capacity,
          seatsTaken,
          seatsLeft: Math.max(r.capacity - seatsTaken, 0),
          phase: endsOn < today ? 'finished' : startsOn > today ? 'upcoming' : 'running',
        };
      });
    },

    async findIntroLesson(courseId: number): Promise<IntroLesson | null> {
      const lesson = await db.lesson.findFirst({
        where: { courseId, isFreeIntro: true },
        select: {
          id: true,
          position: true,
          title: true,
          content: true,
          materials: { orderBy: { id: 'asc' }, select: materialSelect },
        },
      });
      return lesson && { ...lesson, materials: lesson.materials.map(toMaterialView) };
    },
  };
}

export type CatalogRepo = ReturnType<typeof createCatalogRepo>;
