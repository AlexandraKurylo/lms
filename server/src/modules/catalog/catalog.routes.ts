import { Router } from 'express';
import { parseWith } from '../../shared/validate.js';
import { courseIdParamsSchema, listCoursesQuerySchema } from './catalog.schemas.js';
import type { CatalogService } from './catalog.service.js';

export function catalogRouter(deps: { service: CatalogService }): Router {
  const router = Router();

  router.get('/topics', async (_req, res) => {
    res.json({ items: await deps.service.listTopics() });
  });

  router.get('/courses', async (req, res) => {
    const query = parseWith(listCoursesQuerySchema, req.query, 'query');
    res.json(await deps.service.listCourses(query));
  });

  router.get('/courses/:id', async (req, res) => {
    const { id } = parseWith(courseIdParamsSchema, req.params, 'params');
    res.json(await deps.service.getCoursePage(id, req.user));
  });

  router.get('/courses/:id/intro-lesson', async (req, res) => {
    const { id } = parseWith(courseIdParamsSchema, req.params, 'params');
    res.json(await deps.service.getIntroLesson(id, req.user));
  });

  return router;
}
