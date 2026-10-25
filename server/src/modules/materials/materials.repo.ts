import type { Db } from '../../shared/db.js';
import type { OwnerScope } from '../teacher/teacher.scope.js';
import type { CreateLinkInput } from './materials.schemas.js';
import { materialSelect, toMaterialView, type MaterialView } from './materials.view.js';

export interface MaterialAccess {
  lessonId: number;
  isFreeIntro: boolean;
  courseStatus: 'draft' | 'published';
  teacherId: number | null;
  fileName: string | null;
  filePath: string | null;
}

export function createMaterialsRepo(db: Db) {
  const ownLesson = (id: number, scope: OwnerScope) =>
    db.lesson.findFirst({ where: { id, course: { ...scope } }, select: { id: true } });

  return {
    async list(lessonId: number, scope: OwnerScope): Promise<MaterialView[] | null> {
      if (!(await ownLesson(lessonId, scope))) return null;
      const rows = await db.material.findMany({
        where: { lessonId },
        orderBy: { id: 'asc' },
        select: materialSelect,
      });
      return rows.map(toMaterialView);
    },

    async addLink(
      lessonId: number,
      scope: OwnerScope,
      input: CreateLinkInput,
    ): Promise<MaterialView | null> {
      if (!(await ownLesson(lessonId, scope))) return null;
      const row = await db.material.create({
        data: { lessonId, ...input },
        select: materialSelect,
      });
      return toMaterialView(row);
    },

    async addFile(
      lessonId: number,
      scope: OwnerScope,
      input: { title: string; fileName: string; filePath: string },
    ): Promise<MaterialView | null> {
      if (!(await ownLesson(lessonId, scope))) return null;
      const row = await db.material.create({
        data: { lessonId, kind: 'file', url: '', ...input },
        select: materialSelect,
      });
      return toMaterialView(row);
    },

    async remove(id: number, scope: OwnerScope): Promise<{ filePath: string | null } | null> {
      const row = await db.material.findFirst({
        where: { id, lesson: { course: { ...scope } } },
        select: { filePath: true },
      });
      if (!row) return null;
      await db.material.delete({ where: { id } });
      return row;
    },

    async findAccess(id: number): Promise<MaterialAccess | null> {
      const row = await db.material.findUnique({
        where: { id },
        select: {
          fileName: true,
          filePath: true,
          lesson: {
            select: {
              id: true,
              isFreeIntro: true,
              course: { select: { status: true, teacherId: true } },
            },
          },
        },
      });
      if (!row) return null;
      return {
        lessonId: row.lesson.id,
        isFreeIntro: row.lesson.isFreeIntro,
        courseStatus: row.lesson.course.status,
        teacherId: row.lesson.course.teacherId,
        fileName: row.fileName,
        filePath: row.filePath,
      };
    },
  };
}
