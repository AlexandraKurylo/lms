import type { z } from 'zod';
import { DomainError } from './errors.js';

export type RequestPart = 'body' | 'query' | 'params' | 'headers';

/**
 * Перевіряє дані запиту схемою zod. Валідація на сервері обов'язкова (п. 5.4 методички):
 * перевірка лише на клієнті не береться до уваги.
 */
export function parseWith<S extends z.ZodType>(
  schema: S,
  data: unknown,
  source: RequestPart = 'body',
): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new DomainError(
    'validation',
    'Дані не пройшли перевірку',
    result.error.issues.map((issue) => ({
      path: [source, ...issue.path].join('.'),
      message: issue.message,
    })),
  );
}
