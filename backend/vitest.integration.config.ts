import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Integration tests use Testcontainers with real services
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    environment: 'node',
    // Integration tests talk to real containers and share external resources,
    // so we run them in a single thread to avoid cross-test interference
    threads: false,
    // Single worker for integration tests
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 60000, // Integration tests may take longer
    retry: 2, // Retry failed tests up to 2 times
    setupFiles: [
      resolve(__dirname, './tests/setup.ts'),
      resolve(__dirname, './tests/vitest.integration.setup.ts'),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  // Vitest natively supports ESM modules, so no mocks needed for @auth packages
  // Integration tests use real Auth.js implementations with Testcontainers
});

