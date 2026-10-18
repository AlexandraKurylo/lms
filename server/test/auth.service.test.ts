import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { createAuthGuards } from '../src/modules/auth/auth.guards.js';
import { createAuthRepo } from '../src/modules/auth/auth.repo.js';
import { createAuthService, type PasswordHasher } from '../src/modules/auth/auth.service.js';
import pg from 'pg';
import { createPrisma } from '../src/shared/db.js';
import { createTokenService } from '../src/shared/auth/tokens.js';
import { DomainError } from '../src/shared/errors.js';
import { resetTestDatabase } from './helpers/testDb.js';

// мала вартість bcrypt, щоб тести йшли швидко
const hasher: PasswordHasher = {
  hash: (p) => bcrypt.hash(p, 4),
  compare: (p, h) => bcrypt.compare(p, h),
};

const { Pool } = pg;
let pool: pg.Pool;
let prisma: ReturnType<typeof createPrisma>;
const input = { email: 'olena@example.com', password: 'Passw0rd!', name: 'Олена Коваль' };

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof DomainError ? err.code : 'other';
  }
}

beforeAll(async () => {
  const url = await resetTestDatabase();
  pool = new Pool({ connectionString: url });
  prisma = createPrisma(url);
});
afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

function setup() {
  const repo = createAuthRepo(prisma);
  return { repo, service: createAuthService({ repo, hasher }) };
}

describe('реєстрація', () => {
  it('створює студента й не повертає хеш пароля', async () => {
    const { service } = setup();
    const user = await service.register(input);
    expect(user).toEqual({ id: 1, email: input.email, name: input.name, role: 'student' });
    expect('passwordHash' in user).toBe(false);
  });

  it('зберігає хеш, а не пароль; два однакові паролі дають різні хеші', async () => {
    const { service } = setup();
    await service.register(input);
    await service.register({ ...input, email: 'two@example.com' });
    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users ORDER BY id',
    );
    expect(rows[0]!.password_hash).not.toContain(input.password);
    expect(rows[0]!.password_hash).not.toBe(rows[1]!.password_hash);
  });

  it('пошта унікальна без урахування регістру', async () => {
    const { service } = setup();
    await service.register(input);
    expect(await codeOf(service.register({ ...input, email: 'OLENA@example.com' }))).toBe(
      'email-taken',
    );
  });

  it('дві одночасні реєстрації з однією поштою: успіх лише в однієї', async () => {
    const { service } = setup();
    const results = await Promise.allSettled([service.register(input), service.register(input)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
    expect(rows[0]!.n).toBe(1);
  });
});

describe('вхід', () => {
  it('приймає правильний пароль', async () => {
    const { service } = setup();
    await service.register(input);
    const user = await service.login({ email: input.email, password: input.password });
    expect(user.email).toBe(input.email);
  });

  it('хибний пароль і неіснуюча пошта дають однакову помилку', async () => {
    const { service } = setup();
    await service.register(input);
    const wrongPassword = service.login({ email: input.email, password: 'Wrong123' });
    const unknownEmail = service.login({ email: 'nobody@example.com', password: 'Passw0rd!' });
    expect(await codeOf(wrongPassword)).toBe('invalid-credentials');
    expect(await codeOf(unknownEmail)).toBe('invalid-credentials');
  });
});

describe('guards', () => {
  const run = async (mw: any, req: any) => {
    let error: unknown;
    await mw(req, {}, (e?: unknown) => {
      error = e;
    });
    return error;
  };

  it('authenticate підхоплює користувача з cookie і ігнорує недійсний токен', async () => {
    const { repo, service } = setup();
    const tokens = createTokenService('guard-secret-guard-secret-guard-0000');
    const guards = createAuthGuards({ tokens, repo });
    const user = await service.register(input);
    const token = await tokens.sign({ userId: user.id, role: user.role });

    const good: any = { headers: { cookie: `lms_session=${token}` } };
    await run(guards.authenticate, good);
    expect(good.user).toEqual(user);

    const bad: any = { headers: { cookie: 'lms_session=garbage' } };
    await run(guards.authenticate, bad);
    expect(bad.user).toBeUndefined();
  });

  it('видалений користувач втрачає доступ одразу, хоча токен ще дійсний', async () => {
    const { repo, service } = setup();
    const tokens = createTokenService('guard-secret-guard-secret-guard-0000');
    const guards = createAuthGuards({ tokens, repo });
    const user = await service.register(input);
    const token = await tokens.sign({ userId: user.id, role: user.role });
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    const req: any = { headers: { cookie: `lms_session=${token}` } };
    await run(guards.authenticate, req);
    expect(req.user).toBeUndefined();
  });

  it('requireRole: 401 без входу, 403 за неправильної ролі, пропускає потрібну', () => {
    const { repo } = setup();
    const guards = createAuthGuards({ tokens: createTokenService('x'.repeat(32)), repo });
    const mw = guards.requireRole('teacher', 'admin');
    const call = (user?: object) => {
      try {
        mw({ user } as any, {} as any, () => {});
        return 'ok';
      } catch (err) {
        return (err as DomainError).code;
      }
    };
    expect(call(undefined)).toBe('unauthorized');
    expect(call({ role: 'student' })).toBe('forbidden');
    expect(call({ role: 'teacher' })).toBe('ok');
  });
});
