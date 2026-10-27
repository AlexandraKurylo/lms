import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import { idempotencyKeyHeader, requestFingerprint } from '../../shared/idempotency.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import { idParams } from './enrollments.schemas.js';
import type { EnrollmentsService } from './enrollments.service.js';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

export function enrollmentsRouter(deps: {
  service: EnrollmentsService;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  const studentOnly = deps.guards.requireRole('student');

  router.post('/streams/:id/enrollments', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const user = currentUser(req);
    const key = parseWith(idempotencyKeyHeader, req.get('Idempotency-Key'), 'headers');
    if (!key) {
      res.status(201).json(await deps.service.enroll(user, id));
      return;
    }
    const result = await deps.service.enrollIdempotent(user, id, {
      key,
      fingerprint: requestFingerprint(req),
    });
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    res.status(result.status).json(result.body);
  });

  router.get('/me/enrollments', studentOnly, async (req, res) => {
    res.json({ items: await deps.service.listMine(currentUser(req)) });
  });

  router.delete('/me/enrollments/:id', studentOnly, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await deps.service.cancel(currentUser(req), id);
    res.status(204).end();
  });

  return router;
}
