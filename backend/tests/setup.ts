import mongoose from 'mongoose';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

// Jest setup file for global test configuration
// This file runs before all tests

// Set test environment variables that do not depend on containers
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-with-minimum-32-characters';
process.env['SESSION_SECRET'] = 'test-session-secret-with-minimum-32-characters';

// Default MongoDB URI (will be overridden by testcontainers in beforeAll when available)
process.env['MONGODB_URI'] =
  process.env['MONGODB_URI'] || 'mongodb://localhost:27017/hashhive-test';

// Increase test timeout for integration tests
jest.setTimeout(30000);

let mongoContainer: StartedTestContainer | null = null;

beforeAll(async () => {
  // If user has provided a non-local MongoDB URI, respect it and do not start a container
  const currentUri = process.env['MONGODB_URI'];
  if (currentUri && !currentUri.includes('localhost') && !currentUri.includes('127.0.0.1')) {
    return;
  }

  mongoContainer = await new GenericContainer('mongo:7').withExposedPorts(27017).start();

  const host = mongoContainer.getHost();
  const port = mongoContainer.getMappedPort(27017);
  process.env['MONGODB_URI'] = `mongodb://${host}:${port}/hashhive-test`;
});

afterAll(async () => {
  // Close any open Mongoose connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  if (mongoContainer) {
    await mongoContainer.stop();
    mongoContainer = null;
  }
});
