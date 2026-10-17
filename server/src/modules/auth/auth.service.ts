import { DomainError } from '../../shared/errors.js';
import type { AuthRepo } from './auth.repo.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { AuthUser } from './auth.types.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export function createAuthService(deps: { repo: AuthRepo; hasher: PasswordHasher }) {
  const { repo, hasher } = deps;
  // Хеш-«приманка»: якщо користувача немає, все одно виконуємо порівняння,
  // щоб час відповіді не видавав, чи зареєстрована така пошта.
  let decoy: Promise<string> | undefined;
  const decoyHash = () => (decoy ??= hasher.hash('decoy-password-1'));

  return {
    async register(input: RegisterInput): Promise<AuthUser> {
      const passwordHash = await hasher.hash(input.password);
      return repo.insertStudent({ email: input.email, name: input.name, passwordHash });
    },

    async login(input: LoginInput): Promise<AuthUser> {
      const found = await repo.findByEmail(input.email);
      const ok = await hasher.compare(input.password, found?.passwordHash ?? (await decoyHash()));
      if (!found || !ok) {
        // одне й те саме повідомлення для «немає пошти» та «хибний пароль»
        throw new DomainError('invalid-credentials', 'Невірна пошта або пароль');
      }
      const { passwordHash: _omit, ...user } = found;
      return user;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
