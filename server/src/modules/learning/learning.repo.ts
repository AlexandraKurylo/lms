import type { Db } from '../../shared/db.js';
import { SEAT_STATUSES } from '../teacher/teacher.repo.js';

export interface LessonRecord {
  id: number;
  courseId: number;
  position: number;
  title: string;
  content: string;
  isFreeIntro: boolean;
  hasHomework: boolean;
  materials: { id: number; title: string; kind: string; url: string }[];
  course: { title: string; sequentialLessons: boolean };
}

export interface OutlineLesson {
  id: number;
  position: number;
  title: string;
  isFreeIntro: boolean;
  hasHomework: boolean;
}

export interface CourseOutline {
  id: number;
  title: string;
  sequentialLessons: boolean;
  lessons: OutlineLesson[];
}

export function createLearningRepo(db: Db) {
  return {
    async hasSeat(studentId: number, courseId: number): Promise<boolean> {
      const row = await db.enrollment.findFirst({
        where: { studentId, courseId, status: { in: SEAT_STATUSES } },
        select: { id: true },
      });
      return row !== null;
    },

    async findOutline(courseId: number): Promise<CourseOutline | null> {
      const course = await db.course.findFirst({
        where: { id: courseId, status: 'published' },
        select: {
          id: true,
          title: true,
          sequentialLessons: true,
          lessons: {
            orderBy: { position: 'asc' },
            select: { id: true, position: true, title: true, isFreeIntro: true, hasHomework: true },
          },
        },
      });
      return course;
    },

    async findLesson(id: number): Promise<LessonRecord | null> {
      const lesson = await db.lesson.findFirst({
        where: { id, course: { status: 'published' } },
        select: {
          id: true,
          courseId: true,
          position: true,
          title: true,
          content: true,
          isFreeIntro: true,
          hasHomework: true,
          materials: {
            orderBy: { id: 'asc' },
            select: { id: true, title: true, kind: true, url: true },
          },
          course: { select: { title: true, sequentialLessons: true } },
        },
      });
      return lesson;
    },

    async completedLessonIds(studentId: number, courseId: number): Promise<Set<number>> {
      const rows = await db.lessonProgress.findMany({
        where: { studentId, lesson: { courseId } },
        select: { lessonId: true },
      });
      return new Set(rows.map((r) => r.lessonId));
    },

    async markDone(studentId: number, lessonId: number): Promise<void> {
      await db.lessonProgress.createMany({
        data: [{ studentId, lessonId }],
        skipDuplicates: true,
      });
    },

    async unmark(studentId: number, lessonId: number): Promise<void> {
      await db.lessonProgress.deleteMany({ where: { studentId, lessonId } });
    },

    async progressByCourse(
      studentId: number,
      courseIds: number[],
    ): Promise<Map<number, { completed: number; total: number }>> {
      const totals = await db.lesson.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIds } },
        _count: { _all: true },
      });
      const done = await db.lessonProgress.findMany({
        where: { studentId, lesson: { courseId: { in: courseIds } } },
        select: { lesson: { select: { courseId: true } } },
      });
      const result = new Map<number, { completed: number; total: number }>();
      for (const t of totals) result.set(t.courseId, { completed: 0, total: t._count._all });
      for (const d of done) {
        const entry = result.get(d.lesson.courseId);
        if (entry) entry.completed++;
      }
      return result;
    },
  };
}

export type LearningRepo = ReturnType<typeof createLearningRepo>;
