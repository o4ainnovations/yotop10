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
    // For Next.js standalone output, use a small helper that patches the
    // runtime to correctly serve /sw.js and /offline.html from the
    // standalone public directory. We keep this helper in the repo rather
    // than modifying .next/standalone files directly (they are gitignored).
    command: 'node frontend/scripts/start-standalone-with-sw-shim.js',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 120_000,
  },
});
