import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/db';
import { logger } from '../../src/utils/logger';
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

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    mongodb: {
      uri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/test',
      maxPoolSize: 10,
    },
    server: {
      isTest: true,
    },
  },
}));

// Mock mongoose
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    ConnectionStates: actualMongoose.ConnectionStates,
    connection: {
      readyState: 0,
      close: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
    },
  };
});

describe('Database Connection (db/index.ts)', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset connection state to disconnected
    (mongoose.connection as any).readyState = mongoose.ConnectionStates.disconnected;

    // Reset mock implementations
    (mongoose.connect as jest.Mock).mockResolvedValue(mongoose);
    (mongoose.connection.close as jest.Mock).mockResolvedValue(undefined);
  });

  describe('connectDatabase', () => {
    it('should connect to MongoDB successfully', async () => {
      // Simulate successful connection
      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      expect(mongoose.connect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('MongoDB connected successfully');
    });

    it('should skip connection if already connected', async () => {
      // Set connection state to connected
      (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;

      await connectDatabase();

      expect(logger.info).toHaveBeenCalledWith('MongoDB already connected');
      expect(mongoose.connect).not.toHaveBeenCalled();
    });

    it('should mask credentials in log messages', async () => {
      // Temporarily override the config uri
      const originalUri = config.mongodb.uri;
      (config.mongodb as any).uri = 'mongodb://user:password@localhost:27017/test';

      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'mongodb://***@localhost:27017/test',
        }),
        'Attempting MongoDB connection'
      );

      // Restore original uri
      (config.mongodb as any).uri = originalUri;
    });

    it('should retry on connection failure and eventually succeed', async () => {
      let attemptCount = 0;

      // Mock connect to fail twice, then succeed
      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failed');
        }
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      expect(mongoose.connect).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('MongoDB connected successfully');
    });

    it('should throw error after maximum retries', async () => {
      // Mock connect to always fail
      (mongoose.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(connectDatabase()).rejects.toThrow(
        'Failed to connect to MongoDB after maximum retries'
      );

      expect(mongoose.connect).toHaveBeenCalledTimes(3);
      expect(logger.fatal).toHaveBeenCalledWith('MongoDB connection failed after maximum retries');
    });

    it('should use exponential backoff between retries', async () => {
      jest.useFakeTimers();
      let attemptCount = 0;

      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Connection failed');
        }
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      const connectPromise = connectDatabase();

      // Fast-forward through retries
      await jest.advanceTimersByTimeAsync(1000); // First retry delay: 1000ms
      await jest.advanceTimersByTimeAsync(2000); // Second retry delay: 2000ms

      await connectPromise;

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ retryDelay: 1000 }),
        'Retrying MongoDB connection'
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ retryDelay: 2000 }),
        'Retrying MongoDB connection'
      );

      jest.useRealTimers();
    });

    it('should pass correct connection options', async () => {
      const connectSpy = jest.spyOn(mongoose, 'connect');

      await connectDatabase();

      expect(connectSpy).toHaveBeenCalledWith(
        config.mongodb.uri,
        expect.objectContaining({
          maxPoolSize: config.mongodb.maxPoolSize,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          directConnection: config.server.isTest,
        })
      );
    });

    it('should wrap unknown errors with Error object', async () => {
      (mongoose.connect as jest.Mock).mockRejectedValue('string error');

      await expect(connectDatabase()).rejects.toThrow(
        'Failed to connect to MongoDB after maximum retries'
      );
    });

    it('should set up connection event handlers after successful connection', async () => {
      const onSpy = jest.spyOn(mongoose.connection, 'on');

      await connectDatabase();

      expect(onSpy).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });

  describe('disconnectDatabase', () => {
    beforeEach(() => {
      // Set connected state before disconnect tests
      (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
      jest.clearAllMocks();
    });

    it('should disconnect from MongoDB gracefully', async () => {
      (mongoose.connection.close as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.disconnected;
      });

      await disconnectDatabase();

      expect(mongoose.connection.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('MongoDB disconnected gracefully');
    });

    it('should throw error on disconnect failure', async () => {
      const disconnectError = new Error('Disconnect failed');
      (mongoose.connection.close as jest.Mock).mockRejectedValue(disconnectError);

      await expect(disconnectDatabase()).rejects.toThrow('Disconnect failed');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: disconnectError }),
        'Error disconnecting from MongoDB'
      );
    });
  });

  describe('Connection Event Handlers', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (mongoose.connection as any).readyState = mongoose.ConnectionStates.disconnected;
    });

    it('should log on connected event', async () => {
      // Capture event handlers
      const eventHandlers: Record<string, Function> = {};
      (mongoose.connection.on as jest.Mock).mockImplementation(
        (event: string, handler: Function) => {
          eventHandlers[event] = handler;
          return mongoose.connection;
        }
      );

      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      // Trigger connected event
      eventHandlers['connected']?.();

      expect(logger.info).toHaveBeenCalledWith('Mongoose connected to MongoDB');
    });

    it('should log on error event', async () => {
      // Capture event handlers
      const eventHandlers: Record<string, Function> = {};
      (mongoose.connection.on as jest.Mock).mockImplementation(
        (event: string, handler: Function) => {
          eventHandlers[event] = handler;
          return mongoose.connection;
        }
      );

      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      const testError = new Error('Connection error');
      eventHandlers['error']?.(testError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: testError }),
        'Mongoose connection error'
      );
    });

    it('should log on disconnected event', async () => {
      // Capture event handlers
      const eventHandlers: Record<string, Function> = {};
      (mongoose.connection.on as jest.Mock).mockImplementation(
        (event: string, handler: Function) => {
          eventHandlers[event] = handler;
          return mongoose.connection;
        }
      );

      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();

      eventHandlers['disconnected']?.();

      expect(logger.warn).toHaveBeenCalledWith('Mongoose disconnected from MongoDB');
    });
  });

  describe('Connection State Management', () => {
    it('should handle concurrent connection attempts', async () => {
      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      // First call should connect, second and third should see already connected
      const promise1 = connectDatabase();
      // Simulate state change after first connect starts
      await promise1;

      const promise2 = connectDatabase();
      const promise3 = connectDatabase();

      await Promise.all([promise2, promise3]);

      // Only one actual connection should be made
      expect(mongoose.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle reconnection after disconnect', async () => {
      // First connection
      (mongoose.connect as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.connected;
        return mongoose;
      });

      await connectDatabase();
      expect((mongoose.connection as any).readyState).toBe(mongoose.ConnectionStates.connected);

      // Disconnect
      (mongoose.connection.close as jest.Mock).mockImplementation(async () => {
        (mongoose.connection as any).readyState = mongoose.ConnectionStates.disconnected;
      });

      await disconnectDatabase();
      expect((mongoose.connection as any).readyState).toBe(mongoose.ConnectionStates.disconnected);

      jest.clearAllMocks();

      // Reconnect
      await connectDatabase();
      expect((mongoose.connection as any).readyState).toBe(mongoose.ConnectionStates.connected);
      expect(logger.info).toHaveBeenCalledWith('MongoDB connected successfully');
    });
  });
});
