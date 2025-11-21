import mongoose from 'mongoose';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';

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

let mongoContainer: StartedMongoDBContainer | null = null;

beforeAll(async () => {
  // If user has provided an explicit non-local MongoDB URI, respect it and do not start a container
  const currentUri = process.env['MONGODB_URI'];
  if (currentUri && !currentUri.includes('localhost') && !currentUri.includes('127.0.0.1')) {
    return;
  }

  // Use the MongoDB community module to provision an ephemeral test database
  mongoContainer = await new MongoDBContainer('mongo:7').start();

  process.env['MONGODB_URI'] = mongoContainer.getConnectionString();
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
