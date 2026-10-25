import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const submitSchema = z
  .object({
    comment: z.string().trim().max(10_000, 'Не довше 10 000 символів'),
  })
  .strict();

export type SubmitInput = z.infer<typeof submitSchema>;
