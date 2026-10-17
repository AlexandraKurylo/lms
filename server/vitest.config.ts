import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
    // інтеграційні тести ділять одну БД, тому файли виконуються по черзі
    fileParallelism: false,
  },
});
