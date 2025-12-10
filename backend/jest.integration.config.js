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
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    // Integration tests use real Auth.js implementations with Testcontainers
    // No mocks - tests run against real MongoDB adapter and ExpressAuth
    // Note: Jest has limitations with ESM modules from @auth packages, but
    // we work around this by ensuring the app loads Auth.js at runtime via
    // the actual Express server, not at Jest module load time
  },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // Transform @auth packages since they use ESM which Jest doesn't handle natively
  transformIgnorePatterns: [
    // Transform @auth packages and their dependencies (they use ESM)
    'node_modules/(?!(@auth|oauth4webapi))',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/jest.integration.setup.ts'],
  testTimeout: 60000, // Integration tests may take longer
  verbose: true,
};
