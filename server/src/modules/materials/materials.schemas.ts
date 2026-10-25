import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

const title = z.string().trim().min(2, 'Мінімум 2 символи').max(200, 'Максимум 200 символів');

export const createLinkSchema = z
  .object({
    title,
    kind: z.enum(['video', 'article', 'link']),
    url: z
      .string()
      .trim()
      .max(2000, 'Максимум 2000 символів')
      .refine((value) => {
        try {
          const { protocol } = new URL(value);
          return protocol === 'https:' || protocol === 'http:';
        } catch {
          return false;
        }
      }, 'Вкажіть посилання, що починається з http:// або https://'),
  })
  .strict();

export const fileTitleSchema = title;

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
