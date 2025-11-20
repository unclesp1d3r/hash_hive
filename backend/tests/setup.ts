// Jest setup file for global test configuration
// This file runs before all tests

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-with-minimum-32-characters';
process.env['SESSION_SECRET'] = 'test-session-secret-with-minimum-32-characters';

// Increase test timeout for integration tests
jest.setTimeout(30000);
