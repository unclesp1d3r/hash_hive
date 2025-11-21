import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

/**
 * MongoDB connection state
 */
let isConnected = false;

/**
 * Connection options for Mongoose
 */
const connectionOptions = {
  maxPoolSize: config.mongodb.maxPoolSize,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
} satisfies mongoose.ConnectOptions;

/**
 * Connect to MongoDB with retry logic
 * @param retries - Number of retry attempts (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 5000)
 */
export async function connectDatabase(
  retries: number = 5,
  retryDelay: number = 5000
): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  let attempt = 0;

  while (attempt < retries) {
    try {
      attempt++;
      logger.info(
        { attempt, maxRetries: retries, uri: config.mongodb.uri.replace(/\/\/.*@/, '//***@') },
        'Attempting MongoDB connection'
      );

      await mongoose.connect(config.mongodb.uri, connectionOptions);

      isConnected = true;
      logger.info('MongoDB connected successfully');

      // Set up connection event handlers
      setupConnectionHandlers();

      return;
    } catch (error) {
      logger.error({ error, attempt, maxRetries: retries }, 'MongoDB connection failed');

      if (attempt >= retries) {
        logger.fatal('MongoDB connection failed after maximum retries');
        throw new Error('Failed to connect to MongoDB after maximum retries');
      }

      logger.info({ retryDelay }, 'Retrying MongoDB connection');
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Set up MongoDB connection event handlers
 */
function setupConnectionHandlers(): void {
  mongoose.connection.on('connected', () => {
    logger.info('Mongoose connected to MongoDB');
  });

  mongoose.connection.on('error', (error: Error) => {
    logger.error({ error }, 'Mongoose connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongoose disconnected from MongoDB');
    isConnected = false;
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('Mongoose reconnected to MongoDB');
    isConnected = true;
  });

  // Handle process termination
  process.on('SIGINT', () => {
    void disconnectDatabase().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    void disconnectDatabase().then(() => {
      process.exit(0);
    });
  });
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from MongoDB');
    throw error;
  }
}

/**
 * Get current connection state
 */
export function isMongoConnected(): boolean {
  return isConnected && mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/**
 * Drop database (for testing purposes only)
 */
export async function dropDatabase(): Promise<void> {
  if (config.server.isProduction) {
    throw new Error('Cannot drop database in production environment');
  }

  if (!isConnected || mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    throw new Error('Database not connected');
  }

  await mongoose.connection.dropDatabase();
  logger.warn('Database dropped');
}
