import { DomainError, notFound } from '../../shared/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { OwnCourse, OwnStream, TeacherRepo } from './teacher.repo.js';
import { scopeFor } from './teacher.scope.js';
import type {
  CreateCourseInput,
  CreateLessonInput,
  CreateStreamInput,
  UpdateCourseInput,
  UpdateStreamInput,
} from './teacher.schemas.js';

export function createTeacherService(deps: { repo: TeacherRepo }) {
  const { repo } = deps;

  async function get(user: AuthUser, id: number): Promise<OwnCourse> {
    const course = await repo.find(id, scopeFor(user));
    if (!course) throw notFound('Курс');
    return course;
  }

  return {
    list: (user: AuthUser): Promise<OwnCourse[]> => repo.list(scopeFor(user)),

    get,

    /** Власник — користувач із сесії. Ніякого teacherId з тіла запиту. */
    create: (user: AuthUser, input: CreateCourseInput): Promise<OwnCourse> =>
      repo.create(user.id, input),

    async update(user: AuthUser, id: number, input: UpdateCourseInput): Promise<OwnCourse> {
      const scope = scopeFor(user);

      const updated = await repo.update(id, scope, input);
      if (!updated) throw notFound('Курс'); // чужий і неіснуючий курс неможливо відрізнити
      return get(user, id);
    },

    async addLesson(user: AuthUser, courseId: number, input: CreateLessonInput) {
      const lesson = await repo.addLesson(courseId, scopeFor(user), input);
      if (!lesson) throw notFound('Курс');
      return lesson;
    },


    async listStreams(user: AuthUser, courseId: number): Promise<OwnStream[]> {
      const streams = await repo.listStreams(courseId, scopeFor(user));
      if (!streams) throw notFound('Курс');
      return streams;
    },

    async addStream(user: AuthUser, courseId: number, input: CreateStreamInput): Promise<OwnStream> {
      const stream = await repo.addStream(courseId, scopeFor(user), input);
      if (!stream) throw notFound('Курс');
      return stream;
    },

    async getStream(user: AuthUser, id: number): Promise<OwnStream> {
      const stream = await repo.findStream(id, scopeFor(user));
      if (!stream) throw notFound('Потік');
      return stream;
    },

    async updateStream(user: AuthUser, id: number, input: UpdateStreamInput): Promise<OwnStream> {
      const result = await repo.updateStream(id, scopeFor(user), input);
      if (result === 'not-found') throw notFound('Потік');
      if (result === 'capacity-below-taken') {
        throw new DomainError('stream-full', 'Місць не може бути менше, ніж уже зайнято');
      }
      if (result === 'bad-dates') {
        throw new DomainError('validation', 'Дані не пройшли перевірку', [
          { path: 'body.endsOn', message: 'Дата завершення не може бути раніше за дату початку' },
        ]);
      }
      return result;
    },
  };
}

export type TeacherService = ReturnType<typeof createTeacherService>;
