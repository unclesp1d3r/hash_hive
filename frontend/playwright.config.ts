// E2E Test Retry Configuration
// E2E tests may fail due to:
// - Network latency
// - Timing issues with page loads
// - Flaky UI interactions
// Playwright automatically retries failed tests based on the retries configuration.
// CI environments use more retries (2) to handle infrastructure variability.
// Local development uses fewer retries (1) to encourage fixing flaky tests.

import { defineConfig, devices } from '@playwright/test';

const isCI = process.env['CI'] !== undefined && process.env['CI'] !== '';
const MAX_RETRIES = 2;
const MIN_RETRIES = 1;
const CI_WORKERS = 1;
const DEFAULT_WORKERS = 1;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // Retry failed tests. CI environments get 2 retries, local development gets 1.
  retries: isCI ? MAX_RETRIES : MIN_RETRIES,
  workers: isCI ? CI_WORKERS : DEFAULT_WORKERS,
  // 30 second timeout per test. Increase if tests legitimately need more time.
  timeout: 30000,
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
