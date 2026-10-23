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
  signal?: AbortSignal;
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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Не вдалося зв’язатися із сервером');
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
