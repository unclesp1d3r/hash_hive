import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

const DEFAULT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const RETRY_DELAY_MULTIPLIER = 2;
const ATTEMPT_INCREMENT = 1;

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
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
      const mongoUri = config.mongodb.uri;
      const maskedUri = mongoUri.replace(/\/\/.*@/, '//***@');
      logger.info(
        { attempt, maxRetries: DEFAULT_RETRIES, uri: maskedUri },
        'Attempting MongoDB connection'
      );

      // eslint-disable-next-line no-await-in-loop -- Each attempt must complete before the next begins
      await mongoose.connect(mongoUri, {
        maxPoolSize: config.mongodb.maxPoolSize,
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
      // eslint-disable-next-line no-await-in-loop, promise/avoid-new, @typescript-eslint/no-loop-func -- Delay between attempts must be awaited before continuing; retryDelay is captured intentionally
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
