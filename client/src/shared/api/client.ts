export interface FieldError {
  path: string;
  message: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: FieldError[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly problem: Problem | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldErrors(): FieldError[] {
    return this.problem?.errors ?? [];
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  file?: File;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function codeOf(problem: Problem | null, status: number): string {
  return problem?.type.split('/').pop() ?? `http-${status}`;
}

async function readProblem(res: Response): Promise<Problem | null> {
  try {
    const data: unknown = await res.json();
    return typeof data === 'object' && data !== null && 'type' in data ? (data as Problem) : null;
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const { method = 'GET', body, file, headers: extra, signal } = options;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: file
        ? {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name),
            ...extra,
          }
        : body === undefined
          ? undefined
          : { 'Content-Type': 'application/json' },
      body: file ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Не вдалося зв’язатися із сервером');
  }

  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) return api<T>(path, options, true);
  }

  if (!res.ok) {
    const problem = await readProblem(res);
    throw new ApiError(
      res.status,
      codeOf(problem, res.status),
      problem?.detail ?? problem?.title ?? 'Помилка запиту',
      problem,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
