import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import type { FileStorage } from '../../shared/storage.js';
import { readUpload, receiveRaw, sendStoredFile } from '../../shared/upload.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import { idParams, submitSchema } from './learning.schemas.js';
import type { LearningService } from './learning.service.js';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

export function learningRouter(deps: {
  service: LearningService;
  storage: FileStorage;
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

  router.put('/lessons/:id/submission', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const body = parseWith(submitSchema, req.body);
    res.json(await deps.service.submit(currentUser(req), id, body));
  });

  router.put('/lessons/:id/submission/file', studentOnly, receiveRaw, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.attachFile(currentUser(req), id, readUpload(req)));
  });

  router.delete('/lessons/:id/submission/file', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await deps.service.removeFile(currentUser(req), id);
    res.status(204).end();
  });

  router.get('/lessons/:id/submission/file', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await sendStoredFile(res, deps.storage, await deps.service.ownFile(currentUser(req), id));
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
