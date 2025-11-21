/* eslint-disable preserve-caught-error -- MongoDB connection retries intentionally wrap and rethrow errors for clearer context */
import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

/**
 * MongoDB connection state
 */
let isConnected = false;

/**
 * Track if connection handlers have been set up to avoid duplicate registrations
 */
let handlersSetup = false;

const SERVER_SELECTION_TIMEOUT_MS = 5000;
const SOCKET_TIMEOUT_MS = 45000;

/**
 * Connection options for Mongoose
 *
 * In the test environment, we enable `directConnection` so that the MongoDB
 * driver talks directly to the Testcontainers-managed MongoDB instance
 * without attempting replica set discovery on the internal container
 * hostname (which is not resolvable from the host).
 */
const connectionOptions = {
  maxPoolSize: config.mongodb.maxPoolSize,
  serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
  socketTimeoutMS: SOCKET_TIMEOUT_MS,
  directConnection: config.server.isTest,
} satisfies mongoose.ConnectOptions;

/**
 * Connect to MongoDB with retry logic
 * @param retries - Number of retry attempts (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 5000)
 */
const DEFAULT_DB_RETRIES = 5;
const DEFAULT_DB_RETRY_DELAY_MS = 5000;
const RETRY_ATTEMPT_INCREMENT = 1;

export async function connectDatabase(
  retries: number = DEFAULT_DB_RETRIES,
  retryDelay: number = DEFAULT_DB_RETRY_DELAY_MS
): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  let attempt = 0;

  while (attempt < retries) {
    try {
      attempt += RETRY_ATTEMPT_INCREMENT;
      const mongoUri = process.env['MONGODB_URI'] ?? config.mongodb.uri;
      const maskedUri = mongoUri.replace(/\/\/.*@/, '//***@');
      logger.info(
        { attempt, maxRetries: retries, uri: maskedUri },
        'Attempting MongoDB connection'
      );

      // eslint-disable-next-line no-await-in-loop -- Each attempt must complete before the next begins
      await mongoose.connect(mongoUri, connectionOptions);

      isConnected = true;
      logger.info('MongoDB connected successfully');

      // Set up connection event handlers
      setupConnectionHandlers();

      return;
    } catch (error) {
      logger.error({ error, attempt, maxRetries: retries }, 'MongoDB connection failed');

      if (attempt >= retries) {
        logger.fatal('MongoDB connection failed after maximum retries');
        const connectionError =
          error instanceof Error ? error : new Error('Unknown error while connecting to MongoDB');
        throw new Error('Failed to connect to MongoDB after maximum retries', {
          cause: connectionError,
        });
      }

      logger.info({ retryDelay }, 'Retrying MongoDB connection');
      // Sequential retry with delay is intentional; a loop with await is acceptable here.
      // eslint-disable-next-line no-await-in-loop, promise/avoid-new -- Delay between attempts must be awaited before continuing
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryDelay);
      });
    }
  }
}

/**
 * Set up MongoDB connection event handlers
 * Only registers handlers once to avoid duplicate listeners
 */
function setupConnectionHandlers(): void {
  // Only set up handlers once, even if connection is re-established
  if (handlersSetup) {
    return;
  }

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

  // Note: SIGINT and SIGTERM handlers are managed by index.ts graceful shutdown
  // to ensure proper ordering of resource cleanup (server -> queues -> redis -> database)

  handlersSetup = true;
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
