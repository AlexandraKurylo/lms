import { DomainError, notFound } from '../../shared/errors.js';
import { inTransaction, isUniqueViolation, type Db } from '../../shared/db.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  createEnrollmentsRepo,
  type EnrollmentRow,
  type MyEnrollment,
} from './enrollments.repo.js';

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

export function createEnrollmentsService(deps: { db: Db; today?: () => string }) {
  const { db } = deps;
  const today = deps.today ?? todayUtc;

  return {
    async enroll(user: AuthUser, streamId: number): Promise<EnrollmentRow> {
      try {
        return await inTransaction(db, async (tx) => {
          const repo = createEnrollmentsRepo(tx);

          const stream = await repo.lockStream(streamId);
          if (!stream) throw notFound('Потік');

          if (stream.endsOn < today()) {
            throw new DomainError('stream-closed', 'Потік уже завершився');
          }

          const mine = await repo.findByStudentAndCourse(user.id, stream.courseId);
          if (mine.some((e) => e.status === 'active' || e.status === 'completed')) {
            throw new DomainError('already-enrolled', 'Ви вже записані на цей курс');
          }

          const seats = await repo.countSeats(stream.id);
          if (seats >= stream.capacity) {
            throw new DomainError('stream-full', 'На цьому потоці немає вільних місць');
          }

          const cancelled = mine.find((e) => e.streamId === stream.id);
          return cancelled
            ? repo.reactivate(cancelled.id)
            : repo.create(user.id, stream.id, stream.courseId);
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new DomainError('already-enrolled', 'Ви вже записані на цей курс');
        }
        throw err;
      }
    },

    async cancel(user: AuthUser, enrollmentId: number): Promise<void> {
      const ok = await createEnrollmentsRepo(db).cancel(enrollmentId, user.id);
      if (!ok) throw notFound('Запис');
    },

    listMine: (user: AuthUser): Promise<MyEnrollment[]> =>
      createEnrollmentsRepo(db).listMine(user.id),
  };
}

export type EnrollmentsService = ReturnType<typeof createEnrollmentsService>;
