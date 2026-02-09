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
  // bcrypt-ts is ESM-only; must be transformed by ts-jest
  transformIgnorePatterns: ['/node_modules/(?!bcrypt-ts/)'],
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 60000, // Integration tests may take longer
  verbose: true,
};
