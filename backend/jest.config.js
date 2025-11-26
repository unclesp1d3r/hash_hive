module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Run tests in a single worker to avoid interference between integration tests
  // that share external resources like Redis and BullMQ queues.
  maxWorkers: 1,
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  // Exclude integration tests from regular test run (they use test:integration)
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    // Mock Auth.js modules for Jest (they use ESM which Jest doesn't handle well)
    '^@auth/express$': '<rootDir>/tests/mocks/@auth/express.ts',
    '^@auth/mongodb-adapter$': '<rootDir>/tests/mocks/@auth/mongodb-adapter.ts',
    '^@auth/core$': '<rootDir>/tests/mocks/@auth/core.ts',
    '^@auth/core/adapters$': '<rootDir>/tests/mocks/@auth/core/adapters.ts',
    '^@auth/core/providers/credentials$':
      '<rootDir>/tests/mocks/@auth/core/providers/credentials.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(@auth)/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/examples/**/*.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 72,
      lines: 80,
      statements: 80,
    },
    // Temporary overrides for files needing additional test coverage
    // See docs/test-coverage-plan.md for improvement roadmap
    './src/config/index.ts': {
      branches: 25,
    },
    './src/middleware/error-handler.ts': {
      branches: 40,
    },
    './src/routes/health.ts': {
      branches: 50,
    },
    './src/services/auth.service.authjs.ts': {
      statements: 100,
      lines: 100,
    },
    './src/routes/auth.routes.authjs.ts': {
      statements: 0, // Route handlers are tested via integration tests
      lines: 0,
    },
    './src/utils/permission-helpers.ts': {
      statements: 50,
      lines: 50,
      functions: 60,
    },
    // Barrel files (re-export only) - 0% coverage is acceptable
    './src/services/index.ts': {
      functions: 0,
    },
    './src/middleware/index.ts': {
      functions: 0,
    },
    './src/models/index.ts': {
      functions: 0,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
