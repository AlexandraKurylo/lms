import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PRISMA_LOG: z.enum(['query', 'off']).default('off'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обовʼязковий'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET має містити щонайменше 32 символи'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Некоректна конфігурація середовища: ${problems}`);
  }
  return parsed.data;
}
