import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

const DEFAULT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const RETRY_DELAY_MULTIPLIER = 2;
const ATTEMPT_INCREMENT = 1;
const SERVER_SELECTION_TIMEOUT_MS = 5000;
const SOCKET_TIMEOUT_MS = 45000;

/**
 * Connect to MongoDB with retry logic and exponential backoff
 */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    logger.info('MongoDB already connected');
    return;
  }

  let attempt = 0;
  let retryDelay = INITIAL_RETRY_DELAY_MS;

  while (attempt < DEFAULT_RETRIES) {
    try {
      attempt += ATTEMPT_INCREMENT;
      const mongoUri = config.mongodb.uri;
      const maskedUri = mongoUri.replace(/\/\/.*@/, '//***@');
      logger.info(
        { attempt, maxRetries: DEFAULT_RETRIES, uri: maskedUri },
        'Attempting MongoDB connection'
      );

      await mongoose.connect(mongoUri, {
        maxPoolSize: config.mongodb.maxPoolSize,
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
        socketTimeoutMS: SOCKET_TIMEOUT_MS,
        // In test environment, enable directConnection so MongoDB driver talks directly
        // to Testcontainers-managed MongoDB instance without attempting replica set discovery
        // on the internal container hostname (which is not resolvable from the host).
        directConnection: config.server.isTest,
      });

      logger.info('MongoDB connected successfully');
      setupConnectionHandlers();
      return;
    } catch (error: unknown) {
      logger.error({ error, attempt, maxRetries: DEFAULT_RETRIES }, 'MongoDB connection failed');

      if (attempt >= DEFAULT_RETRIES) {
        logger.fatal('MongoDB connection failed after maximum retries');
        const connectionError = error instanceof Error ? error : new Error('Unknown error');
        const failureError = new Error('Failed to connect to MongoDB after maximum retries');
        failureError.cause = connectionError;
        throw failureError;
      }

      logger.info({ retryDelay }, 'Retrying MongoDB connection');
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryDelay);
      });
      retryDelay *= RETRY_DELAY_MULTIPLIER;
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
  });
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from MongoDB');
    throw error;
  }
}

export { mongoose };
