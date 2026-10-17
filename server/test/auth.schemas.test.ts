import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/modules/auth/auth.schemas.js';

const valid = { email: 'Student@Example.com ', password: 'Passw0rd!', name: '  Олена Коваль ' };

describe('registerSchema', () => {
  it('нормалізує пошту (нижній регістр, без пробілів) та імʼя', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('student@example.com');
    expect(parsed.name).toBe('Олена Коваль');
  });

  it.each([
    ['коротка', 'a1'],
    ['без цифри', 'abcdefgh'],
    ['без літери', '12345678'],
  ])('відхиляє пароль: %s', (_label: string, password: string) => {
    expect(registerSchema.safeParse({ ...valid, password }).success).toBe(false);
  });

  it('рахує довжину пароля в байтах: 40 кириличних літер — це 80 байтів, а bcrypt бере лише 72', () => {
    const password = 'ї'.repeat(40) + '1';
    expect(password.length).toBeLessThan(72);
    expect(registerSchema.safeParse({ ...valid, password }).success).toBe(false);
  });

  it('відхиляє некоректну пошту й коротке імʼя', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: ' a ' }).success).toBe(false);
  });

  it('ігнорує зайві поля: роль не потрапляє в розібрані дані', () => {
    const parsed = registerSchema.parse({ ...valid, role: 'admin' });
    expect('role' in parsed).toBe(false);
  });
});

describe('loginSchema', () => {
  it('не перевіряє складність пароля, але вимагає непорожній', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
