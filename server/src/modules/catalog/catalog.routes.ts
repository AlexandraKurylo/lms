import { Router } from 'express';
import { parseWith } from '../../shared/validate.js';
import { listCoursesQuerySchema } from './catalog.schemas.js';
import type { CatalogService } from './catalog.service.js';

/** Публічний каталог: доступний гостям, тому жодних guard-ів тут немає. */
export function catalogRouter(deps: { service: CatalogService }): Router {
  const router = Router();

  router.get('/topics', async (_req, res) => {
    res.json({ items: await deps.service.listTopics() });
  });

  router.get('/courses', async (req, res) => {
    const query = parseWith(listCoursesQuerySchema, req.query, 'query');
    res.json(await deps.service.listCourses(query));
  });

  return router;
}
