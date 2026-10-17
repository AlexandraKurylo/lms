import { DomainError } from './errors.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Курсорна (keyset) пагінація: курсор — це значення ключа сортування останнього рядка сторінки,
 * наприклад [назва, id]. На відміну від OFFSET, база не перебирає пропущені рядки,
 * а сторінки не «роз'їжджаються», коли дані змінюються між запитами.
 */
export function encodeCursor(values: (string | number)[]): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

/** Розбирає курсор. Чужий або зіпсований курсор — це помилка клієнта (400), а не 500. */
export function decodeCursor(raw: string, arity: number): (string | number)[] {
  const bad = () =>
    new DomainError('validation', 'Некоректний курсор', [
      { path: 'query.cursor', message: 'Некоректний курсор' },
    ]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw bad();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== arity ||
    !parsed.every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
  ) {
    throw bad();
  }
  return parsed as (string | number)[];
}

/** Обмежує limit розумними межами; undefined → значення за замовчуванням. */
export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Репозиторій читає `limit + 1` рядків; зайвий рядок лише показує, що далі є ще сторінка.
 * Так клієнт знає про кінець списку без окремого COUNT(*).
 */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (last: T) => (string | number)[],
): Page<T> {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodeCursor(cursorOf(items[items.length - 1] as T)) };
}
