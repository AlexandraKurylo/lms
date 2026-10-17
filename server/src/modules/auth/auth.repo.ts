import { DomainError } from '../../shared/errors.js';
import type { Queryable } from '../../shared/db.js';
import type { AuthUser, Role } from './auth.types.js';

export interface UserWithHash extends AuthUser {
  passwordHash: string;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
}

const toUser = (row: UserRow): UserWithHash => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  passwordHash: row.password_hash,
});

export function createAuthRepo(db: Queryable) {
  return {
    async findByEmail(email: string): Promise<UserWithHash | null> {
      const { rows } = await db.query<UserRow>(
        'SELECT id, email, name, role, password_hash FROM users WHERE lower(email) = lower($1)',
        [email],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },

    async findById(id: number): Promise<AuthUser | null> {
      const { rows } = await db.query<UserRow>(
        'SELECT id, email, name, role, password_hash FROM users WHERE id = $1',
        [id],
      );
      if (!rows[0]) return null;
      const { passwordHash: _omit, ...user } = toUser(rows[0]);
      return user;
    },

    /**
     * Унікальність пошти гарантує індекс у базі, а не попередній SELECT:
     * дві одночасні реєстрації не проскочать між перевіркою та вставкою.
     */
    async insertStudent(input: {
      email: string;
      name: string;
      passwordHash: string;
    }): Promise<AuthUser> {
      try {
        const { rows } = await db.query<UserRow>(
          `INSERT INTO users (email, password_hash, name, role)
           VALUES ($1, $2, $3, 'student')
           RETURNING id, email, name, role, password_hash`,
          [input.email, input.passwordHash, input.name],
        );
        const { passwordHash: _omit, ...user } = toUser(rows[0]!);
        return user;
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          throw new DomainError('email-taken', 'Ця пошта вже зареєстрована');
        }
        throw err;
      }
    },
  };
}

export type AuthRepo = ReturnType<typeof createAuthRepo>;
