import { ApiError } from '../api/client';

export function fieldErrorMap(error: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!(error instanceof ApiError)) return map;
  for (const item of error.fieldErrors) {
    const key = item.path.split('.').pop();
    if (key && !(key in map)) map[key] = item.message;
  }
  return map;
}

export function generalError(error: unknown): string {
  if (!error) return '';
  if (!(error instanceof ApiError)) return 'Не вдалося виконати дію';
  return error.fieldErrors.length > 0 ? '' : error.message;
}
