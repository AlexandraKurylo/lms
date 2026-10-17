import { z } from 'zod';

export const levelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const listCoursesQuerySchema = z.object({
  topic: z.coerce.number().int().positive().optional(),
  level: levelSchema.optional(),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/, 'Двобуквений код мови, наприклад uk')
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1, 'Мінімум 1').max(100, 'Максимум 100').default(20),
  cursor: z.string().min(1).max(500).optional(),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
