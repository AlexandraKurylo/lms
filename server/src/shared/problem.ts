import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { DomainError } from './errors.js';
import type { FieldError, ProblemCode } from './errors.js';

/** Базовий URI типів помилок. `type` = база + код, наприклад .../problems/stream-full. */
export const PROBLEM_TYPE_BASE = 'https://lms.example/problems/';

/**
 * Відповідність «код помилки → HTTP-статус і заголовок».
 * Вибір статусів обґрунтовано в docs/adr/0006-problem-json.md і описано в OpenAPI.
 */
export const PROBLEMS: Record<ProblemCode, { status: number; title: string }> = {
  'bad-request': { status: 400, title: 'Некоректний запит' },
  validation: { status: 400, title: 'Помилка валідації' },
  unauthorized: { status: 401, title: 'Потрібна автентифікація' },
  'invalid-credentials': { status: 401, title: 'Невірний email або пароль' },
  forbidden: { status: 403, title: 'Недостатньо прав' },
  'lesson-locked': { status: 403, title: 'Урок ще закритий' },
  'not-enrolled': { status: 403, title: 'Немає запису на потік цього курсу' },
  'stream-not-started': { status: 403, title: 'Потік ще не розпочався' },
  'not-found': { status: 404, title: 'Ресурс не знайдено' },
  'submission-graded': { status: 409, title: 'Роботу вже оцінено' },
  'email-taken': { status: 409, title: 'Email уже зайнятий' },
  'already-enrolled': { status: 409, title: 'Запис на цей курс уже існує' },
  'stream-full': { status: 409, title: 'На потоці немає вільних місць' },
  'stream-closed': { status: 409, title: 'Потік уже завершився' },
  'has-later-progress': { status: 409, title: 'Позначку не можна зняти' },
  'course-in-use': { status: 409, title: 'Курс має записи студентів' },
  'course-incomplete': { status: 409, title: 'Курс не готовий до публікації' },
  'idempotency-key-reuse': {
    status: 422,
    title: 'Idempotency-Key уже використано з іншим запитом',
  },
  'payload-too-large': { status: 413, title: 'Завеликий запит' },
  'rate-limited': { status: 429, title: 'Забагато запитів' },
  'service-unavailable': { status: 503, title: 'Сервіс тимчасово недоступний' },
  internal: { status: 500, title: 'Внутрішня помилка сервера' },
};

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  requestId: string;
  errors?: FieldError[];
}

export interface ClassifiedError {
  code: ProblemCode;
  detail?: string;
  errors?: FieldError[];
}

/** Перетворює будь-яку помилку на код problem. Чиста функція — легко тестується. */
export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof DomainError) {
    return { code: err.code, detail: err.detail, errors: err.errors };
  }
  if (err instanceof ZodError) {
    return {
      code: 'validation',
      detail: 'Дані не пройшли перевірку',
      errors: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  const known = err as { type?: unknown; code?: unknown } | null;
  // помилки express.json()
  if (known?.type === 'entity.too.large') {
    return { code: 'payload-too-large', detail: 'Запит завеликий (для файлів максимум 10 МБ)' };
  }
  if (known?.type === 'entity.parse.failed') {
    return { code: 'bad-request', detail: 'Тіло запиту не є коректним JSON' };
  }
  // усе інше — наша помилка: деталі в лог, клієнту нічого зайвого
  return { code: 'internal' };
}

export function sendProblem(
  req: Request,
  res: Response,
  code: ProblemCode,
  detail?: string,
  errors?: FieldError[],
): void {
  const { status, title } = PROBLEMS[code];
  const body: ProblemBody = {
    type: PROBLEM_TYPE_BASE + code,
    title,
    status,
    // для 500 деталей немає взагалі: ані тексту помилки, ані стектрейсу
    ...(detail && status < 500 ? { detail } : {}),
    instance: req.originalUrl.split('?')[0] ?? '',
    requestId: req.id,
    ...(errors && errors.length > 0 ? { errors } : {}),
  };
  res
    .status(status)
    .set('Content-Type', 'application/problem+json; charset=utf-8')
    .send(JSON.stringify(body));
}

/** Остаточний обробник помилок: усі відповіді з помилкою мають формат RFC 9457. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const classified = classifyError(err);
    if (classified.code === 'internal') {
      // повна помилка зі стектрейсом — лише в лог (з requestId), не клієнту
      logger.error({ err }, 'unhandled error');
    }
    sendProblem(req, res, classified.code, classified.detail, classified.errors);
  };
}

/** Невідомий маршрут теж повертає problem+json. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new DomainError('not-found', 'Маршрут не існує'));
};
