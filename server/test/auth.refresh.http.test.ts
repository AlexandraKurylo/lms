import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/shared/db.js';
import { createLogger } from '../src/shared/logger.js';
import { resetTestDatabase } from './helpers/testDb.js';

// мала вартість bcrypt, щоб тести йшли швидко
const hasher = {
  hash: (p: string) => bcrypt.hash(p, 4),
  compare: (p: string, h: string) => bcrypt.compare(p, h),
};

const { Pool } = pg;
let pool: pg.Pool;
let prisma: ReturnType<typeof createPrisma>;
let app: ReturnType<typeof createApp>;
const logLines: string[] = [];

const credentials = { email: 'olena@example.com', password: 'Passw0rd!', name: 'Олена Коваль' };

beforeAll(async () => {
  const url = await resetTestDatabase();
  pool = new Pool({ connectionString: url });
  prisma = createPrisma(url);
  // лог пишемо в масив, щоб перевірити рядок «refresh token reuse detected»
  const logger = createLogger('warn', { write: (line: string) => void logLines.push(line) });
  app = createApp({
    logger,
    db: prisma,
    jwtSecret: process.env.JWT_SECRET!,
    cookieSecure: false,
    hasher,
  });
});
afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  logLines.length = 0;
});

/** Усі рядки Set-Cookie відповіді. */
function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}
/** Повний рядок Set-Cookie для cookie з такою назвою (разом із прапорцями). */
function cookieLine(res: request.Response, name: string): string {
  const line = setCookies(res).find((c) => c.startsWith(`${name}=`));
  if (!line) throw new Error(`немає cookie ${name}`);
  return line;
}
/** Лише значення cookie. */
function cookieValue(res: request.Response, name: string): string {
  return cookieLine(res, name).split(';')[0]!.slice(name.length + 1);
}

async function register() {
  return request(app).post('/api/auth/register').send(credentials);
}
async function login() {
  return request(app)
    .post('/api/auth/login')
    .send({ email: credentials.email, password: credentials.password });
}
/** «Браузер» з одним refresh-cookie. */
function refreshWith(token: string) {
  return request(app).post('/api/auth/refresh').set('Cookie', `lms_refresh=${token}`);
}

describe('вхід видає пару токенів', () => {
  it('ставить два httpOnly cookie, а refresh-токена в тілі відповіді немає', async () => {
    const res = await register();
    expect(res.status).toBe(201);

    const session = cookieLine(res, 'lms_session');
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);

    const refresh = cookieLine(res, 'lms_refresh');
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Path=\/api\/auth/);

    expect(JSON.stringify(res.body)).not.toContain(cookieValue(res, 'lms_refresh'));
  });

  it('у базі лежить хеш refresh-токена, а не сам токен', async () => {
    const res = await register();
    const raw = cookieValue(res, 'lms_refresh');
    const { rows } = await pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM refresh_tokens',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(raw);
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('короткий сесійний cookie відкриває /api/auth/me', async () => {
    const res = await register();
    const me = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `lms_session=${cookieValue(res, 'lms_session')}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(credentials.email);
  });
});

describe('оновлення сесії', () => {
  it('обмінює refresh-токен на нову пару й позначає старий використаним', async () => {
    const first = await register();
    const oldToken = cookieValue(first, 'lms_refresh');

    const res = await refreshWith(oldToken);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(credentials.email);
    expect(cookieValue(res, 'lms_refresh')).not.toBe(oldToken);
    expect(setCookies(res).some((c) => c.startsWith('lms_session='))).toBe(true);

    const { rows } = await pool.query<{ used: boolean }>(
      'SELECT used_at IS NOT NULL AS used FROM refresh_tokens ORDER BY id',
    );
    expect(rows.map((r) => r.used)).toEqual([true, false]);
  });

  it('без cookie — 401 у форматі problem+json', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('вигаданий токен — така сама 401', async () => {
    const res = await refreshWith('not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.type).toBe('https://lms.example/problems/unauthorized');
  });
});

describe('виявлення крадіжки (головна перевірка лаби 5)', () => {
  it('повторний старий токен відкликає все сімейство, включно із законним', async () => {
    const first = await register();
    const stolen = cookieValue(first, 'lms_refresh'); // «зловмисник» скопіював cookie

    const legit = await refreshWith(stolen); // законний користувач оновився
    expect(legit.status).toBe(200);
    const legitToken = cookieValue(legit, 'lms_refresh');

    const attacker = await refreshWith(stolen); // зловмисник пред'являє старий токен
    expect(attacker.status).toBe(401);

    const victim = await refreshWith(legitToken); // законний токен теж більше не діє
    expect(victim.status).toBe(401);

    const { rows } = await pool.query<{ revoked: boolean }>(
      'SELECT revoked_at IS NOT NULL AS revoked FROM refresh_tokens',
    );
    expect(rows.every((r) => r.revoked)).toBe(true);
  });

  it('у логах є одне попередження про повторне використання', async () => {
    const first = await register();
    const stolen = cookieValue(first, 'lms_refresh');
    await refreshWith(stolen);
    await refreshWith(stolen);

    const warnings = logLines.filter((l) => l.includes('refresh token reuse detected'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('familyId');
  });

  it('два одночасні запити з одним токеном: успіх лише в одного', async () => {
    const first = await register();
    const token = cookieValue(first, 'lms_refresh');

    const [a, b] = await Promise.all([refreshWith(token), refreshWith(token)]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it('токени іншого входу (іншого сімейства) не зачіпаються', async () => {
    const first = await register();
    const second = await login(); // другий пристрій
    const stolen = cookieValue(first, 'lms_refresh');
    const otherDevice = cookieValue(second, 'lms_refresh');

    await refreshWith(stolen);
    await refreshWith(stolen); // повтор: відкликає лише перше сімейство

    expect((await refreshWith(otherDevice)).status).toBe(200);
  });
});

describe('вихід', () => {
  it('logout відкликає refresh-токен: оновитися вже не можна', async () => {
    const first = await register();
    const token = cookieValue(first, 'lms_refresh');

    const out = await request(app).post('/api/auth/logout').set('Cookie', `lms_refresh=${token}`);
    expect(out.status).toBe(204);

    expect((await refreshWith(token)).status).toBe(401);
  });

  it('logout-all відкликає токени на всіх пристроях', async () => {
    const first = await register();
    const second = await login();
    const tokenA = cookieValue(first, 'lms_refresh');
    const tokenB = cookieValue(second, 'lms_refresh');

    const out = await request(app)
      .post('/api/auth/logout-all')
      .set('Cookie', `lms_session=${cookieValue(first, 'lms_session')}`);
    expect(out.status).toBe(204);

    expect((await refreshWith(tokenA)).status).toBe(401);
    expect((await refreshWith(tokenB)).status).toBe(401);
  });

  it('logout-all без входу — 401', async () => {
    const res = await request(app).post('/api/auth/logout-all');
    expect(res.status).toBe(401);
  });
});
