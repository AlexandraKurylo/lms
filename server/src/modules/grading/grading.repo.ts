import type { Db } from '../../shared/db.js';
import { SEAT_STATUSES } from '../teacher/teacher.repo.js';
import type { OwnerScope } from '../teacher/teacher.scope.js';
import type { GradeInput, SubmissionsStatus } from './grading.schemas.js';

export interface StreamStudent {
  enrollmentId: number;
  studentId: number;
  name: string;
  email: string;
  status: 'active' | 'completed';
  enrolledAt: string;
  progress: { completed: number; total: number; percent: number };
  homework: { total: number; submitted: number; graded: number };
}

export interface StreamSubmission {
  id: number;
  student: { id: number; name: string };
  lesson: { id: number; position: number; title: string };
  comment: string;
  file: { name: string } | null;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
}

const submissionSelect = {
  id: true,
  comment: true,
  fileName: true,
  submittedAt: true,
  grade: true,
  feedback: true,
  gradedAt: true,
  student: { select: { id: true, name: true } },
  lesson: { select: { id: true, position: true, title: true } },
} as const;

function toSubmission(row: {
  id: number;
  comment: string;
  fileName: string | null;
  submittedAt: Date;
  grade: number | null;
  feedback: string | null;
  gradedAt: Date | null;
  student: { id: number; name: string };
  lesson: { id: number; position: number; title: string };
}): StreamSubmission {
  return {
    id: row.id,
    student: row.student,
    lesson: row.lesson,
    comment: row.comment,
    file: row.fileName === null ? null : { name: row.fileName },
    submittedAt: row.submittedAt.toISOString(),
    grade: row.grade,
    feedback: row.feedback,
    gradedAt: row.gradedAt?.toISOString() ?? null,
  };
}

export function createGradingRepo(db: Db) {
  const ownStream = (id: number, scope: OwnerScope) =>
    db.stream.findFirst({
      where: { id, course: { ...scope } },
      select: { id: true, courseId: true },
    });

  return {
    async listStudents(streamId: number, scope: OwnerScope): Promise<StreamStudent[] | null> {
      const stream = await ownStream(streamId, scope);
      if (!stream) return null;

      const enrollments = await db.enrollment.findMany({
        where: { streamId, status: { in: SEAT_STATUSES } },
        orderBy: { student: { name: 'asc' } },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          student: { select: { id: true, name: true, email: true } },
        },
      });
      const studentIds = enrollments.map((e) => e.student.id);

      const [totalLessons, homeworkLessons, done, submitted, graded] = await Promise.all([
        db.lesson.count({ where: { courseId: stream.courseId } }),
        db.lesson.count({ where: { courseId: stream.courseId, hasHomework: true } }),
        db.lessonProgress.groupBy({
          by: ['studentId'],
          where: { studentId: { in: studentIds }, lesson: { courseId: stream.courseId } },
          _count: { _all: true },
        }),
        db.submission.groupBy({
          by: ['studentId'],
          where: { streamId, studentId: { in: studentIds } },
          _count: { _all: true },
        }),
        db.submission.groupBy({
          by: ['studentId'],
          where: { streamId, studentId: { in: studentIds }, gradedAt: { not: null } },
          _count: { _all: true },
        }),
      ]);
      const countOf = (rows: { studentId: number; _count: { _all: number } }[]) =>
        new Map(rows.map((r) => [r.studentId, r._count._all]));
      const doneBy = countOf(done);
      const submittedBy = countOf(submitted);
      const gradedBy = countOf(graded);

      return enrollments.map((e) => {
        const completed = doneBy.get(e.student.id) ?? 0;
        return {
          enrollmentId: e.id,
          studentId: e.student.id,
          name: e.student.name,
          email: e.student.email,
          status: e.status as 'active' | 'completed',
          enrolledAt: e.enrolledAt.toISOString(),
          progress: {
            completed,
            total: totalLessons,
            percent: totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100),
          },
          homework: {
            total: homeworkLessons,
            submitted: submittedBy.get(e.student.id) ?? 0,
            graded: gradedBy.get(e.student.id) ?? 0,
          },
        };
      });
    },

    async listSubmissions(
      streamId: number,
      scope: OwnerScope,
      status: SubmissionsStatus,
    ): Promise<StreamSubmission[] | null> {
      if (!(await ownStream(streamId, scope))) return null;
      const rows = await db.submission.findMany({
        where: {
          streamId,
          ...(status === 'pending' ? { gradedAt: null } : {}),
          ...(status === 'graded' ? { gradedAt: { not: null } } : {}),
        },
        orderBy: { submittedAt: status === 'pending' ? 'asc' : 'desc' },
        take: 500,
        select: submissionSelect,
      });
      return rows.map(toSubmission);
    },

    async findFile(id: number, scope: OwnerScope): Promise<{ key: string; name: string } | null> {
      const row = await db.submission.findFirst({
        where: { id, stream: { course: { ...scope } } },
        select: { fileName: true, filePath: true },
      });
      return row?.fileName && row.filePath ? { key: row.filePath, name: row.fileName } : null;
    },

    async grade(
      id: number,
      scope: OwnerScope,
      input: GradeInput,
    ): Promise<StreamSubmission | null> {
      const updated = await db.submission.updateMany({
        where: { id, stream: { course: { ...scope } } },
        data: {
          grade: input.grade,
          feedback: input.feedback ? input.feedback : null,
          gradedAt: new Date(),
        },
      });
      if (updated.count === 0) return null;
      const row = await db.submission.findUniqueOrThrow({
        where: { id },
        select: submissionSelect,
      });
      return toSubmission(row);
    },
  };
}

export type GradingRepo = ReturnType<typeof createGradingRepo>;
