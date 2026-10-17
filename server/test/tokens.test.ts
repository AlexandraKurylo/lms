import { describe, expect, it } from 'vitest';
import { createTokenService, readCookie } from '../src/shared/auth/tokens.js';

const SECRET = 'unit-test-secret-unit-test-secret-0000';

describe('токени сесії', () => {
  it('підписаний токен перевіряється й повертає claims', async () => {
    const tokens = createTokenService(SECRET);
    const token = await tokens.sign({ userId: 7, role: 'teacher' });
    expect(await tokens.verify(token)).toEqual({ userId: 7, role: 'teacher' });
  });

  it('токен, підписаний іншим секретом, не приймається', async () => {
    const token = await createTokenService(SECRET).sign({ userId: 1, role: 'admin' });
    expect(
      await createTokenService('another-secret-another-secret-00000').verify(token),
    ).toBeNull();
  });

  it('підроблений payload (підміна ролі) не приймається', async () => {
    const tokens = createTokenService(SECRET);
    const [h, , s] = (await tokens.sign({ userId: 1, role: 'student' })).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: '1', role: 'admin' })).toString('base64url');
    expect(await tokens.verify(`${h}.${forged}.${s}`)).toBeNull();
  });

  it('сміття замість токена — просто «не увійшов», а не виняток', async () => {
    expect(await createTokenService(SECRET).verify('not.a.jwt')).toBeNull();
    expect(await createTokenService(SECRET).verify('')).toBeNull();
  });
});

describe('readCookie', () => {
  it('знаходить потрібний cookie серед кількох і розкодовує значення', () => {
    expect(readCookie('a=1; lms_session=abc%20def; b=2', 'lms_session')).toBe('abc def');
  });
  it('повертає undefined, якщо cookie немає або заголовка немає', () => {
    expect(readCookie('a=1', 'lms_session')).toBeUndefined();
    expect(readCookie(undefined, 'lms_session')).toBeUndefined();
  });
});
