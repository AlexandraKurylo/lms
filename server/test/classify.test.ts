import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError } from '../src/shared/errors.js';
import { PROBLEMS, classifyError } from '../src/shared/problem.js';
import { parseWith } from '../src/shared/validate.js';

describe('classifyError', () => {
  it('зберігає код доменної помилки', () => {
    expect(classifyError(new DomainError('stream-full', 'нема місць'))).toMatchObject({
      code: 'stream-full',
      detail: 'нема місць',
    });
  });

  it('перетворює ZodError на validation з переліком полів', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'x' });
    const classified = classifyError(result.success ? null : result.error);
    expect(classified.code).toBe('validation');
    expect(classified.errors?.[0]?.path).toBe('email');
  });

  it('розпізнає помилки парсера JSON', () => {
    expect(classifyError({ type: 'entity.parse.failed' }).code).toBe('bad-request');
    expect(classifyError({ type: 'entity.too.large' }).code).toBe('payload-too-large');
  });

  it('будь-яка невідома помилка стає internal без деталей', () => {
    expect(classifyError(new Error('secret'))).toEqual({ code: 'internal' });
    expect(classifyError('рядок')).toEqual({ code: 'internal' });
  });

  it('кожен код має статус і заголовок', () => {
    for (const [code, problem] of Object.entries(PROBLEMS)) {
      expect(problem.status, code).toBeGreaterThanOrEqual(400);
      expect(problem.title.length).toBeGreaterThan(0);
    }
  });
});

describe('parseWith', () => {
  const schema = z.object({ page: z.coerce.number().int().min(1) });

  it('повертає розібрані дані', () => {
    expect(parseWith(schema, { page: '3' }, 'query')).toEqual({ page: 3 });
  });

  it('кидає validation із шляхом, що містить джерело', () => {
    let caught: unknown;
    try {
      parseWith(schema, { page: 'x' }, 'query');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('validation');
    expect((caught as DomainError).errors?.[0]?.path).toBe('query.page');
  });
});
