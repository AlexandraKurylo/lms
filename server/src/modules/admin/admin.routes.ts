import { Router } from 'express';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import { courseIdParams } from '../teacher/teacher.schemas.js';
import { assignTeacherSchema, setStatusSchema } from './admin.schemas.js';
import type { AdminService } from './admin.service.js';

/** Лише адміністратор: студент і викладач отримують 403. */
export function adminRouter(deps: {
  service: AdminService;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  router.use('/admin', deps.guards.requireRole('admin'));

  router.patch('/admin/courses/:id/status', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    const { status } = parseWith(setStatusSchema, req.body);
    res.json(await deps.service.setStatus(id, status));
  });

  router.patch('/admin/courses/:id/teacher', async (req, res) => {
    const { id } = parseWith(courseIdParams, req.params, 'params');
    const { teacherId } = parseWith(assignTeacherSchema, req.body);
    res.json(await deps.service.assignTeacher(id, teacherId));
  });

  return router;
}
