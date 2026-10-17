/**
 * Коди помилок застосунку. Кожен код відповідає стабільному полю `type` у problem+json
 * (див. problem.ts та OpenAPI). Бізнес-логіка кидає DomainError і нічого не знає про HTTP.
 */
export type ProblemCode =
  | 'bad-request'
  | 'validation'
  | 'unauthorized'
  | 'invalid-credentials'
  | 'forbidden'
  | 'lesson-locked'
  | 'not-enrolled'
  | 'not-found'
  | 'email-taken'
  | 'already-enrolled'
  | 'stream-full'
  | 'stream-closed'
  | 'has-later-progress'
  | 'course-in-use'
  | 'course-incomplete'
  | 'idempotency-key-reuse'
  | 'payload-too-large'
  | 'rate-limited'
  | 'service-unavailable'
  | 'internal';

export interface FieldError {
  path: string;
  message: string;
}

export class DomainError extends Error {
  readonly code: ProblemCode;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor(code: ProblemCode, detail?: string, errors?: FieldError[]) {
    super(detail ?? code);
    this.name = 'DomainError';
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}

export const notFound = (what = 'Ресурс'): DomainError =>
  new DomainError('not-found', `${what} не знайдено`);
