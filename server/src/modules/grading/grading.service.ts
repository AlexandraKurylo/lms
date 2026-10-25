import type { Db } from '../../shared/db.js';
import { notFound } from '../../shared/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import { scopeFor } from '../teacher/teacher.scope.js';
import { createGradingRepo } from './grading.repo.js';
import type { GradeInput, SubmissionsStatus } from './grading.schemas.js';

export function createGradingService(deps: { db: Db }) {
  const repo = () => createGradingRepo(deps.db);

  return {
    async students(user: AuthUser, streamId: number) {
      const items = await repo().listStudents(streamId, scopeFor(user));
      if (!items) throw notFound('Потік');
      return { items };
    },

    async submissions(user: AuthUser, streamId: number, status: SubmissionsStatus) {
      const items = await repo().listSubmissions(streamId, scopeFor(user), status);
      if (!items) throw notFound('Потік');
      return { items };
    },

    async file(user: AuthUser, submissionId: number) {
      const file = await repo().findFile(submissionId, scopeFor(user));
      if (!file) throw notFound('Файл');
      return file;
    },

    async grade(user: AuthUser, submissionId: number, input: GradeInput) {
      const result = await repo().grade(submissionId, scopeFor(user), input);
      if (!result) throw notFound('Робота');
      return result;
    },
  };
}

export type GradingService = ReturnType<typeof createGradingService>;
