export type Role = 'student' | 'teacher' | 'admin';

/** Користувач, якого бачить решта застосунку: без хеша пароля. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Заповнюється middleware `authenticate`, якщо сесійний cookie дійсний. */
      user?: AuthUser;
    }
  }
}
