import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {}

const externalUrl = process.env.E2E_BASE_URL;
const port = Number(process.env.API_PORT ?? 4000);
const baseURL = externalUrl ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'uk-UA',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalUrl
    ? undefined
    : {
        command: 'npm run start',
        cwd: '../server',
        url: `${baseURL}/api/ready`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          ...(process.env as Record<string, string>),
          STATIC_DIR: '../client/dist',
          API_PORT: String(port),
        },
      },
});
