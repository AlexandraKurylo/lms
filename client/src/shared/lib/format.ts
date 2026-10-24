import type { CourseStatus, EnrollmentStatus, Level, Role, StreamPhase } from '../api/types';

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: 'Початковий',
  intermediate: 'Середній',
  advanced: 'Просунутий',
};

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Студент',
  teacher: 'Викладач',
  admin: 'Адміністратор',
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  active: 'Навчаюся',
  completed: 'Завершено',
  cancelled: 'Скасовано',
};

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
};

export const PHASE_LABEL: Record<StreamPhase, string> = {
  upcoming: 'Скоро старт',
  running: 'Триває',
  finished: 'Завершено',
};

export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function seatsText(left: number): string {
  if (left === 0) return 'Місць немає';
  return `${left} ${plural(left, 'вільне місце', 'вільні місця', 'вільних місць')}`;
}

