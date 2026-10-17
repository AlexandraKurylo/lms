import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Не довше 254 символів')
  .email('Некоректна адреса пошти');

// bcrypt ігнорує все після 72-го БАЙТА, а кирилична літера займає 2 байти,
// тому довжину рахуємо саме в байтах.
const password = z
  .string()
  .min(8, 'Щонайменше 8 символів')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Занадто довгий пароль')
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), 'Потрібні літера та цифра');

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(2, 'Щонайменше 2 символи').max(100, 'Не довше 100 символів'),
});

export const loginSchema = z.object({
  email,
  // при вході правила складності не перевіряємо: стара обліковка могла мати інший пароль
  password: z.string().min(1, 'Введіть пароль').max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
