import type { Db } from '../../shared/db.js';
import { DomainError, notFound } from '../../shared/errors.js';
import type { FileStorage } from '../../shared/storage.js';
import type { UploadedFile } from '../../shared/upload.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { LearningService } from '../learning/learning.service.js';
import { scopeFor } from '../teacher/teacher.scope.js';
import { createMaterialsRepo } from './materials.repo.js';
import { fileTitleSchema, type CreateLinkInput } from './materials.schemas.js';

export function createMaterialsService(deps: {
  db: Db;
  storage: FileStorage;
  learning: Pick<LearningService, 'assertReadable'>;
}) {
  const repo = () => createMaterialsRepo(deps.db);

  return {
    async list(user: AuthUser, lessonId: number) {
      const items = await repo().list(lessonId, scopeFor(user));
      if (!items) throw notFound('Урок');
      return { items };
    },

    async addLink(user: AuthUser, lessonId: number, input: CreateLinkInput) {
      const created = await repo().addLink(lessonId, scopeFor(user), input);
      if (!created) throw notFound('Урок');
      return created;
    },

    async addFile(user: AuthUser, lessonId: number, file: UploadedFile, rawTitle: string) {
      const parsed = fileTitleSchema.safeParse(rawTitle === '' ? file.name : rawTitle);
      if (!parsed.success) {
        throw new DomainError('validation', 'Дані не пройшли перевірку', [
          { path: 'headers.x-material-title', message: parsed.error.issues[0]!.message },
        ]);
      }
      const r = repo();
      if (!(await r.list(lessonId, scopeFor(user)))) throw notFound('Урок');
      const key = await deps.storage.save(file.data);
      try {
        const created = await r.addFile(lessonId, scopeFor(user), {
          title: parsed.data,
          fileName: file.name,
          filePath: key,
        });
        if (!created) throw notFound('Урок');
        return created;
      } catch (err) {
        await deps.storage.remove(key);
        throw err;
      }
    },

    async remove(user: AuthUser, id: number): Promise<void> {
      const removed = await repo().remove(id, scopeFor(user));
      if (!removed) throw notFound('Матеріал');
      if (removed.filePath) await deps.storage.remove(removed.filePath);
    },

    async fileFor(user: AuthUser | undefined, id: number): Promise<{ key: string; name: string }> {
      const access = await repo().findAccess(id);
      if (!access?.filePath || !access.fileName) throw notFound('Файл');
      const file = { key: access.filePath, name: access.fileName };

      const owner =
        user !== undefined &&
        (user.role === 'admin' || (user.role === 'teacher' && access.teacherId === user.id));
      if (owner) return file;
      if (access.isFreeIntro && access.courseStatus === 'published') return file;
      if (!user) throw new DomainError('unauthorized', 'Потрібно увійти в обліковий запис');
      if (user.role !== 'student' || access.courseStatus !== 'published') throw notFound('Файл');
      await deps.learning.assertReadable(user, access.lessonId);
      return file;
    },
  };
}

export type MaterialsService = ReturnType<typeof createMaterialsService>;
