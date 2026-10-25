import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const submissionsQuery = z.object({
  status: z.enum(['all', 'pending', 'graded']).default('all'),
});

export const gradeSchema = z
  .object({
    grade: z.number().int('Оцінка має бути цілим числом').min(0).max(100),
    feedback: z.string().trim().max(2000, 'Не довше 2000 символів').optional(),
  })
  .strict();

export type GradeInput = z.infer<typeof gradeSchema>;
export type SubmissionsStatus = z.infer<typeof submissionsQuery>['status'];
