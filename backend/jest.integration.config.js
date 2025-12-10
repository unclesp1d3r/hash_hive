// Integration Test Retry Configuration
// Integration tests may occasionally fail due to:
// - Testcontainers startup timing
// - Network issues with Docker containers
// - Race conditions in async operations
// Jest will automatically retry failed tests up to 2 times before marking them as failed.
// If tests consistently fail even with retries, investigate the root cause rather than increasing retries.

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Integration tests talk to real containers (Redis, MongoDB, MinIO) and
  // share external resources, so we run them in a single worker to avoid
  // cross-test interference.
  maxWorkers: 1,
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/jest.integration.setup.ts'],
  testTimeout: 60000, // Integration tests may take longer
  verbose: true,
};
