import type { Db } from '../../shared/db.js';
import { isUniqueViolation } from '../../shared/db.js';
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

export interface SubmissionRecord {
  comment: string;
  file: { name: string } | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

const submissionSelect = {
  comment: true,
  fileName: true,
  submittedAt: true,
  grade: true,
  feedback: true,
  gradedAt: true,
} as const;

function toSubmission(row: {
  comment: string;
  fileName: string | null;
  submittedAt: Date;
  grade: number | null;
  feedback: string | null;
  gradedAt: Date | null;
}): SubmissionRecord {
  return {
    comment: row.comment,
    file: row.fileName === null ? null : { name: row.fileName },
    submittedAt: row.submittedAt.toISOString(),
    grade: row.grade,
    feedback: row.feedback,
    gradedAt: row.gradedAt?.toISOString() ?? null,
  };
}

export function createLearningRepo(db: Db) {
  return {
    async seatStarts(studentId: number, courseId: number): Promise<string[]> {
      const rows = await db.enrollment.findMany({
        where: { studentId, courseId, status: { in: SEAT_STATUSES } },
        select: { stream: { select: { startsOn: true } } },
      });
      return rows.map((r) => r.stream.startsOn.toISOString().slice(0, 10)).sort();
    },

    async startedStreamId(
      studentId: number,
      courseId: number,
      today: string,
    ): Promise<number | null> {
      const row = await db.enrollment.findFirst({
        where: {
          studentId,
          courseId,
          status: { in: SEAT_STATUSES },
          stream: { startsOn: { lte: new Date(`${today}T00:00:00.000Z`) } },
        },
        orderBy: { stream: { startsOn: 'asc' } },
        select: { streamId: true },
      });
      return row?.streamId ?? null;
    },

    async findSubmission(studentId: number, lessonId: number): Promise<SubmissionRecord | null> {
      const row = await db.submission.findUnique({
        where: { studentId_lessonId: { studentId, lessonId } },
        select: submissionSelect,
      });
      return row ? toSubmission(row) : null;
    },

    async findStoredFile(
      studentId: number,
      lessonId: number,
    ): Promise<{ key: string; name: string } | null> {
      const row = await db.submission.findUnique({
        where: { studentId_lessonId: { studentId, lessonId } },
        select: { fileName: true, filePath: true },
      });
      return row?.fileName && row.filePath ? { key: row.filePath, name: row.fileName } : null;
    },

    async saveFile(input: {
      studentId: number;
      lessonId: number;
      streamId: number;
      fileName: string;
      filePath: string;
    }): Promise<{ submission: SubmissionRecord; replacedKey: string | null } | 'graded'> {
      const { studentId, lessonId, streamId, fileName, filePath } = input;
      const where = { studentId_lessonId: { studentId, lessonId } };
      const previous = await db.submission.findUnique({
        where,
        select: { filePath: true, gradedAt: true },
      });
      if (previous?.gradedAt) return 'graded';
      if (previous) {
        const updated = await db.submission.updateMany({
          where: { studentId, lessonId, gradedAt: null },
          data: { fileName, filePath, streamId, submittedAt: new Date() },
        });
        if (updated.count === 0) return 'graded';
      } else {
        try {
          await db.submission.create({
            data: { studentId, lessonId, streamId, comment: '', fileName, filePath },
          });
        } catch (err) {
          if (isUniqueViolation(err)) return 'graded';
          throw err;
        }
      }
      const row = await db.submission.findUniqueOrThrow({ where, select: submissionSelect });
      return { submission: toSubmission(row), replacedKey: previous?.filePath ?? null };
    },

    async removeFile(
      studentId: number,
      lessonId: number,
    ): Promise<{ removedKey: string | null; submission: SubmissionRecord | null } | 'graded'> {
      const where = { studentId_lessonId: { studentId, lessonId } };
      const current = await db.submission.findUnique({
        where,
        select: { comment: true, filePath: true, gradedAt: true },
      });
      if (!current) return { removedKey: null, submission: null };
      if (current.gradedAt) return 'graded';
      if (current.comment === '') {
        await db.submission.deleteMany({ where: { studentId, lessonId, gradedAt: null } });
        return { removedKey: current.filePath, submission: null };
      }
      await db.submission.updateMany({
        where: { studentId, lessonId, gradedAt: null },
        data: { fileName: null, filePath: null },
      });
      const row = await db.submission.findUniqueOrThrow({ where, select: submissionSelect });
      return { removedKey: current.filePath, submission: toSubmission(row) };
    },

    async saveSubmission(input: {
      studentId: number;
      lessonId: number;
      streamId: number;
      comment: string;
    }): Promise<SubmissionRecord | 'graded'> {
      const { studentId, lessonId, streamId, comment } = input;
      const updated = await db.submission.updateMany({
        where: { studentId, lessonId, gradedAt: null },
        data: { comment, streamId, submittedAt: new Date() },
      });
      if (updated.count === 0) {
        try {
          await db.submission.create({ data: { studentId, lessonId, streamId, comment } });
        } catch (err) {
          if (isUniqueViolation(err)) return 'graded';
          throw err;
        }
      }
      const row = await db.submission.findUniqueOrThrow({
        where: { studentId_lessonId: { studentId, lessonId } },
        select: submissionSelect,
      });
      return toSubmission(row);
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
