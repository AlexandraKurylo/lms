import { DomainError } from '../../shared/errors.js';
import { decodeCursor, toPage, type Page } from '../../shared/pagination.js';
import type { AuthUser } from '../auth/auth.types.js';
import type {
  CatalogRepo,
  CourseRecord,
  CourseSummary,
  IntroLesson,
  LessonOutline,
  StreamInfo,
} from './catalog.repo.js';
import type { ListCoursesQuery } from './catalog.schemas.js';

export interface CoursePage extends Omit<CourseRecord, 'teacherId'> {
  topics: { id: number; name: string }[];
  lessons: LessonOutline[];
  streams: StreamInfo[];
}

export function createCatalogService(deps: { repo: CatalogRepo }) {
  const { repo } = deps;

  /**
   * Чернетку бачать лише адміністратор і викладач-власник. Для всіх інших вона «не існує»:
   * відповідаємо 404, а не 403, щоб не підтверджувати, що такий курс є.
   */
  async function loadVisibleCourse(
    id: number,
    viewer: AuthUser | undefined,
  ): Promise<CourseRecord> {
    const course = await repo.findCourse(id);
    const canSeeDraft =
      viewer !== undefined &&
      (viewer.role === 'admin' || (viewer.role === 'teacher' && viewer.id === course?.teacherId));
    if (!course || (course.status === 'draft' && !canSeeDraft)) {
      throw new DomainError('not-found', 'Курс не знайдено');
    }
    return course;
  }

  function parseAfter(cursor: string | undefined): { title: string; id: number } | undefined {
    if (cursor === undefined) return undefined;
    const [title, id] = decodeCursor(cursor, 2);
    if (typeof title !== 'string' || typeof id !== 'number' || !Number.isInteger(id)) {
      throw new DomainError('validation', 'Некоректний курсор', [
        { path: 'query.cursor', message: 'Некоректний курсор' },
      ]);
    }
    return { title, id };
  }

  return {
    listTopics: () => repo.listTopics(),

    async listCourses(query: ListCoursesQuery): Promise<Page<CourseSummary>> {
      const rows = await repo.listPublished({
        topic: query.topic,
        level: query.level,
        language: query.language,
        q: query.q,
        after: parseAfter(query.cursor),
        limit: query.limit,
      });
      return toPage(rows, query.limit, (last) => [last.title, last.id]);
    },

    async getCoursePage(id: number, viewer: AuthUser | undefined): Promise<CoursePage> {
      const course = await loadVisibleCourse(id, viewer);
      const [topics, lessons, streams] = await Promise.all([
        repo.topicsOfCourse(id),
        repo.lessonOutline(id),
        repo.streamsOfCourse(id),
      ]);
      const { teacherId: _omit, ...rest } = course;
      return { ...rest, topics, lessons, streams };
    },

    async getIntroLesson(id: number, viewer: AuthUser | undefined): Promise<IntroLesson> {
      await loadVisibleCourse(id, viewer);
      const lesson = await repo.findIntroLesson(id);
      if (!lesson) throw new DomainError('not-found', 'У цього курсу немає вступного уроку');
      return lesson;
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
