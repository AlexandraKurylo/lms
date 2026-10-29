import type { Db } from '../../shared/db.js';
import { notFound } from '../../shared/errors.js';
import { createGradingRepo, type StreamStudent } from '../grading/grading.repo.js';
import { SEAT_STATUSES } from '../teacher/teacher.repo.js';

export interface AdminTeacher {
  id: number;
  name: string;
  email: string;
}

export interface AdminStream {
  id: number;
  title: string;
  startsOn: string;
  endsOn: string;
  capacity: number;
  seatsTaken: number;
  course: { id: number; title: string };
}

export interface ReportStudent extends StreamStudent {
  averageGrade: number | null;
}

export interface StreamReport {
  stream: AdminStream & { teacher: { id: number; name: string } | null };
  summary: {
    students: number;
    finished: number;
    averageProgress: number;
    homeworkSubmitted: number;
    homeworkGraded: number;
    averageGrade: number | null;
  };
  students: ReportStudent[];
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

export function createAdminReports(db: Db) {
  return {
    async listTeachers(): Promise<AdminTeacher[]> {
      return db.user.findMany({
        where: { role: 'teacher' },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true, email: true },
      });
    },

    async listStreams(): Promise<AdminStream[]> {
      const rows = await db.stream.findMany({
        orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
        take: 200,
        select: {
          id: true,
          title: true,
          startsOn: true,
          endsOn: true,
          capacity: true,
          course: { select: { id: true, title: true } },
          _count: { select: { enrollments: { where: { status: { in: SEAT_STATUSES } } } } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        startsOn: isoDate(r.startsOn),
        endsOn: isoDate(r.endsOn),
        capacity: r.capacity,
        seatsTaken: r._count.enrollments,
        course: r.course,
      }));
    },

    async streamReport(streamId: number): Promise<StreamReport> {
      const stream = await db.stream.findUnique({
        where: { id: streamId },
        select: {
          id: true,
          title: true,
          startsOn: true,
          endsOn: true,
          capacity: true,
          course: {
            select: { id: true, title: true, teacher: { select: { id: true, name: true } } },
          },
        },
      });
      if (!stream) throw notFound('Потік');

      const students = (await createGradingRepo(db).listStudents(streamId, {})) ?? [];
      const grades = await db.submission.groupBy({
        by: ['studentId'],
        where: { streamId, grade: { not: null } },
        _avg: { grade: true },
      });
      const avgBy = new Map(grades.map((g) => [g.studentId, g._avg.grade]));
      const rows: ReportStudent[] = students.map((s) => {
        const avg = avgBy.get(s.studentId);
        return { ...s, averageGrade: avg === undefined || avg === null ? null : oneDecimal(avg) };
      });

      const total = await db.submission.aggregate({
        where: { streamId, grade: { not: null } },
        _avg: { grade: true },
      });
      const sum = (pick: (s: StreamStudent) => number) => rows.reduce((acc, s) => acc + pick(s), 0);

      return {
        stream: {
          id: stream.id,
          title: stream.title,
          startsOn: isoDate(stream.startsOn),
          endsOn: isoDate(stream.endsOn),
          capacity: stream.capacity,
          seatsTaken: rows.length,
          course: { id: stream.course.id, title: stream.course.title },
          teacher: stream.course.teacher,
        },
        summary: {
          students: rows.length,
          finished: rows.filter((s) => s.progress.total > 0 && s.progress.percent === 100).length,
          averageProgress:
            rows.length === 0 ? 0 : Math.round(sum((s) => s.progress.percent) / rows.length),
          homeworkSubmitted: sum((s) => s.homework.submitted),
          homeworkGraded: sum((s) => s.homework.graded),
          averageGrade: total._avg.grade === null ? null : oneDecimal(total._avg.grade),
        },
        students: rows,
      };
    },
  };
}
