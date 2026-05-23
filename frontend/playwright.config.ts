import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 120_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Allow service workers in the test browser context so SW registration and
    // offline behaviors can be tested. Playwright defaults to blocking SW in
    // some environments.
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // For Next.js standalone output, use the standalone server entrypoint
    // `next start` is incompatible with `output: 'standalone'` builds.
    command: 'node .next/standalone/server.js',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 120_000,
  },
});
