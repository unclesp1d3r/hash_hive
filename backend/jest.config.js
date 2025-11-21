module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 79,
      functions: 73,
      lines: 80,
      statements: 80,
    },
    // Temporary overrides for files needing additional test coverage
    // See docs/test-coverage-plan.md for improvement roadmap
    './src/config/index.ts': {
      branches: 33,
    },
    './src/middleware/error-handler.ts': {
      branches: 40,
    },
    './src/routes/health.ts': {
      branches: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
