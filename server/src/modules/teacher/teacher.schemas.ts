import { z } from 'zod';
import { levelSchema } from '../catalog/catalog.schemas.js';

const title = z.string().trim().min(3, 'Мінімум 3 символи').max(200, 'Максимум 200 символів');
const description = z.string().trim().max(5000, 'Максимум 5000 символів');
const language = z.string().regex(/^[a-z]{2}$/, 'Двобуквений код мови, наприклад uk');

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

export const updateLessonSchema = z
  .object({
    title: z.string().trim().min(2, 'Мінімум 2 символи').max(200, 'Максимум 200 символів').optional(),
    content: z.string().max(50_000, 'Максимум 50000 символів').optional(),
    isFreeIntro: z.boolean().optional(),
    hasHomework: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Передайте хоча б одне поле для зміни');
  
export const lessonIdParams = z.object({ id: z.coerce.number().int().positive() });

export const courseIdParams = z.object({ id: z.coerce.number().int().positive() });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;


const streamTitle = z.string().trim().min(2, 'Мінімум 2 символи').max(200, 'Максимум 200 символів');
const isoDate = z.iso.date('Дата у форматі РРРР-ММ-ДД');
const capacity = z.number().int('Ціле число').min(1, 'Мінімум 1 місце').max(1000, 'Максимум 1000 місць');

export const createStreamSchema = z
  .object({ title: streamTitle, startsOn: isoDate, endsOn: isoDate, capacity })
  .strict()
  .refine((s) => s.endsOn >= s.startsOn, {
    path: ['endsOn'],
    message: 'Дата завершення не може бути раніше за дату початку',
  });

export const updateStreamSchema = z
  .object({
    title: streamTitle.optional(),
    startsOn: isoDate.optional(),
    endsOn: isoDate.optional(),
    capacity: capacity.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Передайте хоча б одне поле для зміни');

export const streamIdParams = z.object({ id: z.coerce.number().int().positive() });

export type CreateStreamInput = z.infer<typeof createStreamSchema>;
export type UpdateStreamInput = z.infer<typeof updateStreamSchema>;
