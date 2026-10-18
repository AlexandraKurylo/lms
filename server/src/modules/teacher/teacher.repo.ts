import type { Db } from '../../shared/db.js';
import type { OwnerScope } from './teacher.scope.js';
import type { CreateCourseInput, CreateLessonInput, UpdateCourseInput } from './teacher.schemas.js';

export interface OwnCourse {
  id: number;
  title: string;
  description: string;
  language: string;
  level: string;
  status: 'draft' | 'published';
  sequentialLessons: boolean;
  teacherId: number | null;
  lessonCount: number;
  updatedAt: string;
}

const select = {
  id: true,
  title: true,
  description: true,
  language: true,
  level: true,
  status: true,
  sequentialLessons: true,
  teacherId: true,
  updatedAt: true,
  _count: { select: { lessons: true } },
} as const;

function toOwnCourse(row: {
  id: number;
  title: string;
  description: string;
  language: string;
  level: string;
  status: 'draft' | 'published';
  sequentialLessons: boolean;
  teacherId: number | null;
  updatedAt: Date;
  _count: { lessons: number };
}): OwnCourse {
  const { _count, updatedAt, ...rest } = row;
  return { ...rest, lessonCount: _count.lessons, updatedAt: updatedAt.toISOString() };
}

/**
 * Кожен метод, що чіпає наявний курс, приймає `scope` і вкладає його В УМОВУ ЗАПИТУ.
 * Не «знайшли курс → перевірили власника в коді», а «шукаємо курс, який і є мій»:
 * чужий курс для запиту просто не існує, і між перевіркою та дією немає проміжку для гонки.
 */
export function createTeacherRepo(db: Db) {
  return {
    async list(scope: OwnerScope): Promise<OwnCourse[]> {
      const rows = await db.course.findMany({
        where: { ...scope },
        select,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toOwnCourse);
    },

    async find(id: number, scope: OwnerScope): Promise<OwnCourse | null> {
      const row = await db.course.findFirst({ where: { id, ...scope }, select });
      return row ? toOwnCourse(row) : null;
    },

    async create(teacherId: number, input: CreateCourseInput): Promise<OwnCourse> {
      const row = await db.course.create({ data: { ...input, teacherId }, select });
      return toOwnCourse(row);
    },

    /** true, якщо курс знайдено серед «своїх» і змінено; false — його немає або він чужий. */
    async update(id: number, scope: OwnerScope, input: UpdateCourseInput): Promise<boolean> {
      const { count } = await db.course.updateMany({
        where: { id, ...scope },
        data: { ...input, updatedAt: new Date() },
      });
      return count === 1;
    },

    /** Додає урок в кінець. Курс шукається з умовою власника, тому до чужого уроки не додати. */
    async addLesson(
      courseId: number,
      scope: OwnerScope,
      input: CreateLessonInput,
    ): Promise<{ id: number; position: number } | null> {
      const course = await db.course.findFirst({ where: { id: courseId, ...scope }, select: { id: true } });
      if (!course) return null;
      const last = await db.lesson.aggregate({ where: { courseId }, _max: { position: true } });
      const position = (last._max.position ?? 0) + 1;
      const lesson = await db.lesson.create({
        data: { ...input, courseId, position },
        select: { id: true, position: true },
      });
      return lesson;
    },
  };
}

export type TeacherRepo = ReturnType<typeof createTeacherRepo>;
