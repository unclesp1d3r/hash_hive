/* eslint-disable @typescript-eslint/prefer-destructuring -- Redis config uses imperative property access where destructuring adds little value */
import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

/**
 * Create and configure Redis client with health checks and reconnection logic
 */
export const createRedisClient = (): Redis => {
  const MAX_RETRIES_PER_REQUEST = 3;

  const options: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: number;
    retryStrategy: (times: number) => number;
    reconnectOnError: (err: Error) => boolean;
    lazyConnect: boolean;
  } = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: MAX_RETRIES_PER_REQUEST,
    retryStrategy: (times: number) => {
      const BASE_DELAY_MS = 50;
      const MAX_DELAY_MS = 2000;
      const delay = Math.min(times * BASE_DELAY_MS, MAX_DELAY_MS);
      logger.warn({ attempt: times, delay }, 'Redis connection retry');
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        logger.warn({ error: err.message }, 'Redis reconnecting on READONLY error');
        return true;
      }
      return false;
    },
    lazyConnect: true, // Don't connect immediately, wait for explicit connect()
  };

  if (config.redis.password !== '' && config.redis.password !== undefined) {
    options.password = config.redis.password;
  }

  const client = new Redis(options);

  // Connection event handlers
  client.on('connect', () => {
    logger.info(
      {
        host: config.redis.host,
        port: config.redis.port,
      },
      'Redis client connecting'
    );
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (error: Error) => {
    logger.error({ error }, 'Redis client error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  client.on('end', () => {
    logger.warn('Redis connection ended');
  });

  return client;
};

/**
 * Connect to Redis with health check
 */
export const connectRedis = async (): Promise<Redis> => {
  if (redisClient !== null && redisClient.status === 'ready') {
    return redisClient;
  }

  logger.info('Initializing Redis connection...');

  redisClient = createRedisClient();

  try {
    await redisClient.connect();

    // Verify connection with PING
    const pongLiteral = await redisClient.ping();
    const pong: string = pongLiteral;
    if (pong !== 'PONG') {
      throw new Error(`Redis PING failed: expected "PONG", received "${pong}"`);
    }

    logger.info('✅ Redis connected successfully');
    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis');
    throw error;
  }
};

/**
 * Disconnect from Redis gracefully
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient === null) {
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from Redis');
    // Force close if graceful quit fails
    if (redisClient !== null) {
      redisClient.disconnect();
    }
    redisClient = null;
  }
};

/**
 * Get the current Redis client instance
 */
export const getRedisClient = (): Redis => {
  if (redisClient?.status !== 'ready') {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

/**
 * Check Redis health status
 */
export const checkRedisHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> => {
  if (redisClient?.status !== 'ready') {
    return {
      status: 'unhealthy',
      error: 'Redis client not connected',
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
