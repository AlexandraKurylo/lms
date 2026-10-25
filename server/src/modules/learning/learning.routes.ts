import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import { idParams } from './learning.schemas.js';
import type { LearningService } from './learning.service.js';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

export function learningRouter(deps: {
  service: LearningService;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  const studentOnly = deps.guards.requireRole('student');

  router.get('/me/courses/:id/progress', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.courseProgress(currentUser(req), id));
  });

  router.get('/lessons/:id', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.lesson(currentUser(req), id));
  });

  router.put('/lessons/:id/progress', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.complete(currentUser(req), id));
  });

  router.delete('/lessons/:id/progress', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.uncomplete(currentUser(req), id));
  });

  return router;
}
