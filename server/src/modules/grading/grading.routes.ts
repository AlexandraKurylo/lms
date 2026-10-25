import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import type { FileStorage } from '../../shared/storage.js';
import { sendStoredFile } from '../../shared/upload.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import { gradeSchema, idParams, submissionsQuery } from './grading.schemas.js';
import type { GradingService } from './grading.service.js';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

export function gradingRouter(deps: {
  service: GradingService;
  storage: FileStorage;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  router.use('/teacher', deps.guards.requireRole('teacher', 'admin'));

  router.get('/teacher/streams/:id/students', async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.students(currentUser(req), id));
  });

  router.get('/teacher/streams/:id/submissions', async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const { status } = parseWith(submissionsQuery, req.query, 'query');
    res.json(await deps.service.submissions(currentUser(req), id, status));
  });

  router.get('/teacher/submissions/:id/file', async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await sendStoredFile(res, deps.storage, await deps.service.file(currentUser(req), id));
  });

  router.put('/teacher/submissions/:id/grade', async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const body = parseWith(gradeSchema, req.body);
    res.json(await deps.service.grade(currentUser(req), id, body));
  });

  return router;
}
