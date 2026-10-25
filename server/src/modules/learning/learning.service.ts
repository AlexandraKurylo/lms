import type { Db } from '../../shared/db.js';
import { DomainError, notFound } from '../../shared/errors.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  createLearningRepo,
  type CourseOutline,
  type LessonRecord,
  type LearningRepo,
} from './learning.repo.js';
import { toSummary, type ProgressSummary } from './learning.progress.js';

export interface CourseProgress {
  courseId: number;
  started: boolean;
  startsOn: string;
  title: string;
  sequentialLessons: boolean;
  progress: ProgressSummary;
  lessons: {
    id: number;
    position: number;
    title: string;
    isFreeIntro: boolean;
    hasHomework: boolean;
    completed: boolean;
    locked: boolean;
  }[];
}

export interface LessonView {
  id: number;
  courseId: number;
  courseTitle: string;
  position: number;
  title: string;
  content: string;
  hasHomework: boolean;
  materials: { id: number; title: string; kind: string; url: string }[];
  completed: boolean;
  previousLessonId: number | null;
  nextLessonId: number | null;
  progress: ProgressSummary;
}

function lockedIds(outline: CourseOutline, done: Set<number>): Set<number> {
  const locked = new Set<number>();
  if (!outline.sequentialLessons) return locked;
  let blocked = false;
  for (const lesson of outline.lessons) {
    if (blocked && !done.has(lesson.id)) locked.add(lesson.id);
    if (!done.has(lesson.id)) blocked = true;
  }
  return locked;
}

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const formatDay = (iso: string): string => iso.split('-').reverse().join('.');

export function createLearningService(deps: { db: Db; today?: () => string }) {
  const today = deps.today ?? todayUtc;
  const repo = (): LearningRepo => createLearningRepo(deps.db);

  async function open(user: AuthUser, lessonId: number) {
    const r = repo();
    const lesson = await r.findLesson(lessonId);
    if (!lesson) throw notFound('Урок');
    const starts = await r.seatStarts(user.id, lesson.courseId);
    if (starts.length === 0) {
      throw new DomainError('not-enrolled', 'Щоб відкрити урок, запишіться на потік цього курсу');
    }
    if (!starts.some((day) => day <= today())) {
      throw new DomainError(
        'stream-not-started',
        `Навчання почнеться ${formatDay(starts[0]!)}, тоді відкриються уроки`,
      );
    }
    const outline = await r.findOutline(lesson.courseId);
    if (!outline) throw notFound('Урок');
    const done = await r.completedLessonIds(user.id, lesson.courseId);
    return { r, lesson, outline, done };
  }

  function assertOpen(lesson: LessonRecord, outline: CourseOutline, done: Set<number>): void {
    if (lockedIds(outline, done).has(lesson.id)) {
      throw new DomainError('lesson-locked', 'Спершу позначте попередній урок як пройдений');
    }
  }

  const summary = (outline: CourseOutline, done: Set<number>) =>
    toSummary(outline.lessons.filter((l) => done.has(l.id)).length, outline.lessons.length);

  return {
    async courseProgress(user: AuthUser, courseId: number): Promise<CourseProgress> {
      const r = repo();
      const outline = await r.findOutline(courseId);
      if (!outline) throw notFound('Курс');
      const starts = await r.seatStarts(user.id, courseId);
      if (starts.length === 0) {
        throw new DomainError('not-enrolled', 'Ви не записані на цей курс');
      }
      const started = starts.some((day) => day <= today());
      const done = await r.completedLessonIds(user.id, courseId);
      const locked = started ? lockedIds(outline, done) : new Set(outline.lessons.map((l) => l.id));
      return {
        courseId: outline.id,
        started,
        startsOn: starts[0]!,
        title: outline.title,
        sequentialLessons: outline.sequentialLessons,
        progress: summary(outline, done),
        lessons: outline.lessons.map((l) => ({
          ...l,
          completed: done.has(l.id),
          locked: locked.has(l.id),
        })),
      };
    },

    async lesson(user: AuthUser, lessonId: number): Promise<LessonView> {
      const { lesson, outline, done } = await open(user, lessonId);
      assertOpen(lesson, outline, done);
      const index = outline.lessons.findIndex((l) => l.id === lesson.id);
      return {
        id: lesson.id,
        courseId: lesson.courseId,
        courseTitle: lesson.course.title,
        position: lesson.position,
        title: lesson.title,
        content: lesson.content,
        hasHomework: lesson.hasHomework,
        materials: lesson.materials,
        completed: done.has(lesson.id),
        previousLessonId: outline.lessons[index - 1]?.id ?? null,
        nextLessonId: outline.lessons[index + 1]?.id ?? null,
        progress: summary(outline, done),
      };
    },

    async complete(user: AuthUser, lessonId: number): Promise<ProgressSummary> {
      const { r, lesson, outline, done } = await open(user, lessonId);
      assertOpen(lesson, outline, done);
      await r.markDone(user.id, lesson.id);
      done.add(lesson.id);
      return summary(outline, done);
    },

    async uncomplete(user: AuthUser, lessonId: number): Promise<ProgressSummary> {
      const { r, lesson, outline, done } = await open(user, lessonId);
      const laterDone = outline.lessons.some((l) => l.position > lesson.position && done.has(l.id));
      if (outline.sequentialLessons && laterDone) {
        throw new DomainError(
          'has-later-progress',
          'Спершу зніміть позначки з уроків, що йдуть після цього',
        );
      }
      await r.unmark(user.id, lesson.id);
      done.delete(lesson.id);
      return summary(outline, done);
    },
  };
}

export type LearningService = ReturnType<typeof createLearningService>;
