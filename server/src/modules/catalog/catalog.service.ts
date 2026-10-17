import { DomainError } from '../../shared/errors.js';
import { decodeCursor, toPage, type Page } from '../../shared/pagination.js';
import type { CatalogRepo, CourseSummary } from './catalog.repo.js';
import type { ListCoursesQuery } from './catalog.schemas.js';

export function createCatalogService(deps: { repo: CatalogRepo }) {
  const { repo } = deps;

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
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
