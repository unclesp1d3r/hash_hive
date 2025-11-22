import mongoose from 'mongoose';
import {
  connectDatabase,
  disconnectDatabase,
  isMongoConnected,
  dropDatabase,
} from '../../src/config/database';
import { config } from '../../src/config';

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('Database Connection', () => {
  beforeEach(async () => {
    // Ensure clean state before each test
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('connectDatabase', () => {
    it('should connect to MongoDB successfully', async () => {
      await connectDatabase();

      expect(isMongoConnected()).toBe(true);
      expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    });

    it('should not reconnect if already connected', async () => {
      await connectDatabase();
      const firstConnectionState = mongoose.connection.readyState;

      await connectDatabase();
      const secondConnectionState = mongoose.connection.readyState;

      expect(firstConnectionState).toBe(secondConnectionState);
      expect(isMongoConnected()).toBe(true);
    });

    it('should handle connection with custom retry parameters', async () => {
      await connectDatabase(3, 1000);

      expect(isMongoConnected()).toBe(true);
    });
  });

  describe('disconnectDatabase', () => {
    it('should disconnect from MongoDB gracefully', async () => {
      await connectDatabase();
      expect(isMongoConnected()).toBe(true);

      await disconnectDatabase();

      expect(isMongoConnected()).toBe(false);
      expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
    });

    it('should handle disconnect when not connected', async () => {
      await expect(disconnectDatabase()).resolves.not.toThrow();
    });
  });

  describe('isMongoConnected', () => {
    it('should return false when not connected', () => {
      expect(isMongoConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      await connectDatabase();

      expect(isMongoConnected()).toBe(true);
    });
  });

  describe('dropDatabase', () => {
    it('should drop database in test environment', async () => {
      await connectDatabase();

      // Create a test collection
      const TestModel = mongoose.model('Test', new mongoose.Schema({ name: String }));
      await TestModel.create({ name: 'test' });

      await dropDatabase();

      // Verify database is empty
      const db = mongoose.connection.db;
      if (db !== undefined) {
        const collections = await db.listCollections().toArray();
        expect(collections.length).toBe(0);
      }
    });

    it('should throw error in production environment', async () => {
      const originalIsProduction = config.server.isProduction;
      // Temporarily override for testing
      Object.defineProperty(config.server, 'isProduction', {
        value: true,
        writable: true,
        configurable: true,
      });

      await connectDatabase();

      await expect(dropDatabase()).rejects.toThrow(
        'Cannot drop database in production environment'
      );

      // Restore original environment
      Object.defineProperty(config.server, 'isProduction', {
        value: originalIsProduction,
        writable: true,
        configurable: true,
      });
    });

    it('should throw error when not connected', async () => {
      await expect(dropDatabase()).rejects.toThrow('Database not connected');
    });
  });
});
