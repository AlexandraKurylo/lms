import { z } from 'zod';

export const setStatusSchema = z.object({ status: z.enum(['draft', 'published']) }).strict();
export const assignTeacherSchema = z.object({ teacherId: z.number().int().positive() }).strict();
