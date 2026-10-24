import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  courseIdParams,
  createCourseSchema,
  createLessonSchema,
  createStreamSchema,
  lessonIdParams,
  streamIdParams,
  updateCourseSchema,
  updateLessonSchema,
  updateStreamSchema,
} from './teacher.schemas.js';
import type { TeacherService } from './teacher.service.js';

/** requireRole уже відсіяв гостей, але типи цього не знають: перевіряємо явно, без `!`. */
function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

/**
 * Три рівні захисту (лаба 6):
 *   1. 401 — немає сесії;
 *   2. 403 — є сесія, але роль не teacher/admin (middleware requireRole на весь роутер);
 *   3. 404 — роль підходить, але курс чужий (умова власника всередині запиту до БД).
 */
export function teacherRouter(deps: {
  service: TeacherService;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  router.use('/teacher', deps.guards.requireRole('teacher', 'admin'));

  router.get('/teacher/courses', async (req, res) => {
    res.json({ items: await deps.service.list(currentUser(req)) });
  });

  router.post('/teacher/courses', async (req, res) => {
    const body = parseWith(createCourseSchema, req.body);
    res.status(201).json(await deps.service.create(currentUser(req), body));
  });

  router.get('/teacher/courses/:id', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    res.json(await deps.service.get(currentUser(req), id));
  });

  router.patch('/teacher/courses/:id', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    const body = parseWith(updateCourseSchema, req.body);
    res.json(await deps.service.update(currentUser(req), id, body));
  });

  router.post('/teacher/courses/:id/lessons', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    const body = parseWith(createLessonSchema, req.body);
    res.status(201).json(await deps.service.addLesson(currentUser(req), id, body));
  });

  router.get('/teacher/lessons/:id', async (req, res) => {
    const { id } = parseWith(lessonIdParams, req.params, 'params');
    res.json(await deps.service.getLesson(currentUser(req), id));
  });

  router.patch('/teacher/lessons/:id', async (req, res) => {
    const { id } = parseWith(lessonIdParams, req.params, 'params');
    const body = parseWith(updateLessonSchema, req.body);
    res.json(await deps.service.updateLesson(currentUser(req), id, body));
  });

  router.get('/teacher/courses/:id/streams', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    res.json({ items: await deps.service.listStreams(currentUser(req), id) });
  });

  router.post('/teacher/courses/:id/streams', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    const body = parseWith(createStreamSchema, req.body);
    res.status(201).json(await deps.service.addStream(currentUser(req), id, body));
  });

  router.get('/teacher/streams/:id', async (req, res) => {
    const { id } = parseWith(streamIdParams, req.params, 'params');
    res.json(await deps.service.getStream(currentUser(req), id));
  });

  router.patch('/teacher/streams/:id', async (req, res) => {
    const { id } = parseWith(streamIdParams, req.params, 'params');
    const body = parseWith(updateStreamSchema, req.body);
    res.json(await deps.service.updateStream(currentUser(req), id, body));
  });

  return router;
}
