import { defineConfig, devices } from '@playwright/test';

const isCI = process.env['CI'] !== undefined && process.env['CI'] !== '';
const MAX_RETRIES = 2;
const MIN_RETRIES = 0;
const CI_WORKERS = 1;
const DEFAULT_WORKERS = 1;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? MAX_RETRIES : MIN_RETRIES,
  workers: isCI ? CI_WORKERS : DEFAULT_WORKERS,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

// Only add webServer in non-CI environments
if (!isCI) {
  config.webServer = {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  };
}

export default config;
