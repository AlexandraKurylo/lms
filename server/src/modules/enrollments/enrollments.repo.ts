import type { Db } from '../../shared/db.js';
import { SEAT_STATUSES } from '../teacher/teacher.repo.js';

export interface LockedStream {
  id: number;
  courseId: number;
  capacity: number;
  endsOn: string;
}

export interface EnrollmentRow {
  id: number;
  streamId: number;
  courseId: number;
  status: 'active' | 'completed' | 'cancelled';
  enrolledAt: string;
}

export interface MyEnrollment extends EnrollmentRow {
  course: { id: number; title: string };
  stream: { id: number; title: string; startsOn: string; endsOn: string };
}

const rowSelect = {
  id: true,
  streamId: true,
  courseId: true,
  status: true,
  enrolledAt: true,
} as const;

function toRow(r: {
  id: number;
  streamId: number;
  courseId: number;
  status: 'active' | 'completed' | 'cancelled';
  enrolledAt: Date;
}): EnrollmentRow {
  return { ...r, enrolledAt: r.enrolledAt.toISOString() };
}

export function createEnrollmentsRepo(db: Db) {
  return {
    async lockStream(id: number): Promise<LockedStream | null> {
      const rows = await db.$queryRaw<LockedStream[]>`
        SELECT s.id,
               s.course_id AS "courseId",
               s.capacity,
               to_char(s.ends_on, 'YYYY-MM-DD') AS "endsOn"
        FROM streams s
        JOIN courses c ON c.id = s.course_id
        WHERE s.id = ${id} AND c.status = 'published'
        FOR UPDATE OF s`;
      return rows[0] ?? null;
    },

    countSeats(streamId: number): Promise<number> {
      return db.enrollment.count({ where: { streamId, status: { in: SEAT_STATUSES } } });
    },

    async findByStudentAndCourse(studentId: number, courseId: number): Promise<EnrollmentRow[]> {
      const rows = await db.enrollment.findMany({
        where: { studentId, courseId },
        select: rowSelect,
      });
      return rows.map(toRow);
    },

    async create(studentId: number, streamId: number, courseId: number): Promise<EnrollmentRow> {
      const row = await db.enrollment.create({
        data: { studentId, streamId, courseId },
        select: rowSelect,
      });
      return toRow(row);
    },

    async reactivate(id: number): Promise<EnrollmentRow> {
      const row = await db.enrollment.update({
        where: { id },
        data: { status: 'active', enrolledAt: new Date() },
        select: rowSelect,
      });
      return toRow(row);
    },

    async cancel(id: number, studentId: number): Promise<boolean> {
      const { count } = await db.enrollment.updateMany({
        where: { id, studentId, status: 'active' },
        data: { status: 'cancelled' },
      });
      return count === 1;
    },

    async listMine(studentId: number): Promise<MyEnrollment[]> {
      const rows = await db.enrollment.findMany({
        where: { studentId },
        orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
        select: {
          ...rowSelect,
          stream: {
            select: {
              id: true,
              title: true,
              startsOn: true,
              endsOn: true,
              course: { select: { id: true, title: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        ...toRow(r),
        course: r.stream.course,
        stream: {
          id: r.stream.id,
          title: r.stream.title,
          startsOn: r.stream.startsOn.toISOString().slice(0, 10),
          endsOn: r.stream.endsOn.toISOString().slice(0, 10),
        },
      }));
    },
  };
}

export type EnrollmentsRepo = ReturnType<typeof createEnrollmentsRepo>;
