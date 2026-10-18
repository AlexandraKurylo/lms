import { DomainError } from '../../shared/errors.js';
import { isUniqueViolation, type Db } from '../../shared/db.js';
import type { AuthUser } from './auth.types.js';

export interface UserWithHash extends AuthUser {
  passwordHash: string;
}

const userSelect = { id: true, email: true, name: true, role: true } as const;

export function createAuthRepo(db: Db) {
  return {
    /** Пошук без урахування регістру: A@x.com і a@x.com — той самий акаунт. */
    async findByEmail(email: string): Promise<UserWithHash | null> {
      return db.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { ...userSelect, passwordHash: true },
      });
    },

    async findById(id: number): Promise<AuthUser | null> {
      return db.user.findUnique({ where: { id }, select: userSelect });
    },

    /**
     * Унікальність пошти гарантує індекс у базі (lower(email)), а не попередній SELECT:
     * дві одночасні реєстрації не проскочать між перевіркою та вставкою.
     */
    async insertStudent(input: {
      email: string;
      name: string;
      passwordHash: string;
    }): Promise<AuthUser> {
      try {
        return await db.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            name: input.name,
            role: 'student',
          },
          select: userSelect,
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new DomainError('email-taken', 'Ця пошта вже зареєстрована');
        }
        throw err;
      }
    },
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;

