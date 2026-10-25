import { Router } from 'express';
import type { Request } from 'express';
import { DomainError } from '../../shared/errors.js';
import type { FileStorage } from '../../shared/storage.js';
import { readUpload, receiveRaw, sendStoredFile } from '../../shared/upload.js';
import { parseWith } from '../../shared/validate.js';
import type { AuthGuards } from '../auth/auth.guards.js';
import type { AuthUser } from '../auth/auth.types.js';
import { createLinkSchema, idParams } from './materials.schemas.js';
import type { MaterialsService } from './materials.service.js';

function currentUser(req: Request): AuthUser {
  if (!req.user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
  return req.user;
}

function decodedHeader(req: Request, name: string): string {
  const raw = req.header(name) ?? '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function materialsRouter(deps: {
  service: MaterialsService;
  storage: FileStorage;
  guards: Pick<AuthGuards, 'requireRole'>;
}): Router {
  const router = Router();
  const staff = deps.guards.requireRole('teacher', 'admin');

  router.get('/teacher/lessons/:id/materials', staff, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    res.json(await deps.service.list(currentUser(req), id));
  });

  router.post('/teacher/lessons/:id/materials', staff, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const body = parseWith(createLinkSchema, req.body);
    res.status(201).json(await deps.service.addLink(currentUser(req), id, body));
  });

  router.put('/teacher/lessons/:id/materials/file', staff, receiveRaw, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    const created = await deps.service.addFile(
      currentUser(req),
      id,
      readUpload(req),
      decodedHeader(req, 'x-material-title'),
    );
    res.status(201).json(created);
  });

  router.delete('/teacher/materials/:id', staff, async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await deps.service.remove(currentUser(req), id);
    res.status(204).end();
  });

  router.get('/materials/:id/file', async (req, res) => {
    const { id } = parseWith(idParams, req.params, 'params');
    await sendStoredFile(res, deps.storage, await deps.service.fileFor(req.user, id));
  });

  return router;
}
