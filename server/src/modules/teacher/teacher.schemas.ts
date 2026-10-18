import { z } from 'zod';
import { levelSchema } from '../catalog/catalog.schemas.js';

const title = z.string().trim().min(3, 'Мінімум 3 символи').max(200, 'Максимум 200 символів');
const description = z.string().trim().max(5000, 'Максимум 5000 символів');
const language = z.string().regex(/^[a-z]{2}$/, 'Двобуквений код мови, наприклад uk');

// У схемах НЕМАЄ teacherId. Власник береться лише із сесії, а зайві поля в тілі
// (.strict()) відхиляються: спроба підсунути чужого власника дає 400, а не тихо ігнорується.
export const createCourseSchema = z
  .object({
    title,
    description: description.default(''),
    language: language.default('uk'),
    level: levelSchema.default('beginner'),
    sequentialLessons: z.boolean().default(true),
  })
  .strict();

export const updateCourseSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    language: language.optional(),
    level: levelSchema.optional(),
    sequentialLessons: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Передайте хоча б одне поле для зміни');

export const createLessonSchema = z
  .object({
    title: z.string().trim().min(2, 'Мінімум 2 символи').max(200, 'Максимум 200 символів'),
    content: z.string().max(50_000, 'Максимум 50000 символів').default(''),
    isFreeIntro: z.boolean().default(false),
    hasHomework: z.boolean().default(false),
  })
  .strict();

export const courseIdParams = z.object({ id: z.coerce.number().int().positive() });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
