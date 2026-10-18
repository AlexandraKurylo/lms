import { notFound } from '../../shared/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { OwnCourse, TeacherRepo } from './teacher.repo.js';
import { scopeFor } from './teacher.scope.js';
import type { CreateCourseInput, CreateLessonInput, UpdateCourseInput } from './teacher.schemas.js';

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
  };
}

export type TeacherService = ReturnType<typeof createTeacherService>;
