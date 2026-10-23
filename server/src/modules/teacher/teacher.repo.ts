import type { Db } from '../../shared/db.js';
import { inTransaction, type Prisma } from '../../shared/db.js';
import type { OwnerScope } from './teacher.scope.js';
import type {
  CreateCourseInput,
  CreateLessonInput,
  CreateStreamInput,
  UpdateCourseInput,
  UpdateStreamInput,
} from './teacher.schemas.js';

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

export interface OwnStream {
  id: number;
  courseId: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  seatsTaken: number;
}

export const SEAT_STATUSES: ('active' | 'completed')[] = ['active', 'completed'];

const streamSelect = {
  id: true,
  courseId: true,
  title: true,
  startsOn: true,
  endsOn: true,
  capacity: true,
  _count: { select: { enrollments: { where: { status: { in: SEAT_STATUSES } } } } },
} satisfies Prisma.StreamSelect;

function toOwnStream(row: {
  id: number;
  courseId: number;
  title: string;
  startsOn: Date;
  endsOn: Date;
  capacity: number;
  _count: { enrollments: number };
}): OwnStream {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    startsOn: row.startsOn.toISOString().slice(0, 10),
    endsOn: row.endsOn.toISOString().slice(0, 10),
    capacity: row.capacity,
    seatsTaken: row._count.enrollments,
  };
}

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

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


    async listStreams(courseId: number, scope: OwnerScope): Promise<OwnStream[] | null> {
      const course = await db.course.findFirst({ where: { id: courseId, ...scope }, select: { id: true } });
      if (!course) return null;
      const rows = await db.stream.findMany({
        where: { courseId },
        select: streamSelect,
        orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
      });
      return rows.map(toOwnStream);
    },

    async addStream(
      courseId: number,
      scope: OwnerScope,
      input: CreateStreamInput,
    ): Promise<OwnStream | null> {
      const course = await db.course.findFirst({ where: { id: courseId, ...scope }, select: { id: true } });
      if (!course) return null;
      const row = await db.stream.create({
        data: {
          courseId,
          title: input.title,
          startsOn: toDate(input.startsOn),
          endsOn: toDate(input.endsOn),
          capacity: input.capacity,
        },
        select: streamSelect,
      });
      return toOwnStream(row);
    },

    async findStream(id: number, scope: OwnerScope): Promise<OwnStream | null> {
      const row = await db.stream.findFirst({
        where: { id, course: { ...scope } },
        select: streamSelect,
      });
      return row ? toOwnStream(row) : null;
    },

    async updateStream(
      id: number,
      scope: OwnerScope,
      input: UpdateStreamInput,
    ): Promise<OwnStream | 'not-found' | 'capacity-below-taken' | 'bad-dates'> {
      return inTransaction(db, async (tx) => {
        const own = await tx.stream.findFirst({ where: { id, course: { ...scope } }, select: { id: true } });
        if (!own) return 'not-found' as const;

        await tx.$queryRaw`SELECT id FROM streams WHERE id = ${id} FOR UPDATE`;

        const current = await tx.stream.findUniqueOrThrow({ where: { id }, select: streamSelect });
        const startsOn = input.startsOn ?? current.startsOn.toISOString().slice(0, 10);
        const endsOn = input.endsOn ?? current.endsOn.toISOString().slice(0, 10);
        if (endsOn < startsOn) return 'bad-dates' as const;
        if (input.capacity !== undefined && input.capacity < current._count.enrollments) {
          return 'capacity-below-taken' as const;
        }

        const row = await tx.stream.update({
          where: { id },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.startsOn !== undefined ? { startsOn: toDate(input.startsOn) } : {}),
            ...(input.endsOn !== undefined ? { endsOn: toDate(input.endsOn) } : {}),
            ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          },
          select: streamSelect,
        });
        return toOwnStream(row);
      });
    },
  };
}

export type TeacherRepo = ReturnType<typeof createTeacherRepo>;
