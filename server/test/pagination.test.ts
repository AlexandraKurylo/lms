import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/shared/errors.js';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  clampLimit,
  decodeCursor,
  encodeCursor,
  toPage,
} from '../src/shared/pagination.js';

describe('курсор', () => {
  it('кодується й розкодовується без втрат, включно з кирилицею', () => {
    const cursor = encodeCursor(['Алгоритми і структури даних', 17]);
    expect(decodeCursor(cursor, 2)).toEqual(['Алгоритми і структури даних', 17]);
  });

  it('безпечний для URL (base64url без +, / та =)', () => {
    expect(encodeCursor(['??>>', 1])).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['не base64-json', '%%%'],
    ['не масив', Buffer.from('{"a":1}').toString('base64url')],
    ['не та довжина', Buffer.from('["a"]').toString('base64url')],
    ['зайвий тип', Buffer.from('["a",null]').toString('base64url')],
  ])('відхиляє зіпсований курсор: %s', (_name: string, raw: string) => {
    expect(() => decodeCursor(raw, 2)).toThrow(DomainError);
  });
});

describe('clampLimit', () => {
  it('використовує значення за замовчуванням і обмежує межі', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(10_000)).toBe(MAX_LIMIT);
    expect(clampLimit(25.9)).toBe(25);
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
  });
});

describe('toPage', () => {
  const rows = [1, 2, 3, 4, 5].map((id) => ({ id, title: `T${id}` }));
  const cursorOf = (r: { id: number; title: string }) => [r.title, r.id];

  it('якщо рядків більше за limit — відрізає зайвий і дає курсор останнього показаного', () => {
    const page = toPage(rows.slice(0, 4), 3, cursorOf);
    expect(page.items.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(decodeCursor(page.nextCursor!, 2)).toEqual(['T3', 3]);
  });

  it('якщо рядків не більше за limit — це остання сторінка', () => {
    expect(toPage(rows.slice(0, 3), 3, cursorOf).nextCursor).toBeNull();
    expect(toPage([], 3, cursorOf)).toEqual({ items: [], nextCursor: null });
  });
});
