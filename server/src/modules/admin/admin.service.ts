import type { Db } from '../../shared/db.js';
import { DomainError, notFound } from '../../shared/errors.js';
import { createAdminReports } from './admin.reports.js';

/** Дії адміністратора: публікація курсів, призначення викладача, довідники й звіт за потоком. */
export function createAdminService(deps: { db: Db }) {
  const { db } = deps;

  return {
    ...createAdminReports(db),

    async setStatus(courseId: number, status: 'draft' | 'published') {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { id: true, _count: { select: { lessons: true } } },
      });
      if (!course) throw notFound('Курс');
      if (status === 'published' && course._count.lessons === 0) {
        throw new DomainError('course-incomplete', 'Додайте хоча б один урок перед публікацією');
      }
      return db.course.update({
        where: { id: courseId },
        data: { status, updatedAt: new Date() },
        select: { id: true, status: true, teacherId: true },
      });
    },

    async assignTeacher(courseId: number, teacherId: number) {
      const teacher = await db.user.findFirst({
        where: { id: teacherId, role: 'teacher' },
        select: { id: true },
      });
      if (!teacher) {
        throw new DomainError('validation', 'Дані не пройшли перевірку', [
          { path: 'body.teacherId', message: 'Викладача з таким id не знайдено' },
        ]);
      }
      const { count } = await db.course.updateMany({
        where: { id: courseId },
        data: { teacherId, updatedAt: new Date() },
      });
      if (count === 0) throw notFound('Курс');
      return { id: courseId, teacherId };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
