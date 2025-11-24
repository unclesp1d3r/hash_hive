import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

const BASE_DELAY_MS = 50;
const MAX_DELAY_MS = 2000;

/**
 * Retry strategy with exponential backoff
 */
const retryStrategy = (times: number): number => {
  const delay = Math.min(times * BASE_DELAY_MS, MAX_DELAY_MS);
  logger.warn({ attempt: times, delay }, 'Redis connection retry');
  return delay;
};

/**
 * Connect to Redis with retry logic
 */
export async function connectRedis(): Promise<Redis> {
  if (redisClient !== null && redisClient.status === 'ready') {
    return redisClient;
  }

  logger.info('Initializing Redis connection...');

  const options: {
    host: string;
    port: number;
    password?: string;
    retryStrategy: (times: number) => number;
    lazyConnect: boolean;
  } = {
    host: config.redis.host,
    port: config.redis.port,
    retryStrategy,
    lazyConnect: true,
  };

  // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
  const redisPassword = config.redis.password;
  if (redisPassword !== undefined && redisPassword !== '') {
    options.password = redisPassword;
  }

  redisClient = new Redis(options);

  // Connection event handlers
  redisClient.on('connect', () => {
    logger.info({ host: config.redis.host, port: config.redis.port }, 'Redis client connecting');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('error', (error: Error) => {
    logger.error({ error }, 'Redis client error');
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  try {
    await redisClient.connect();
    logger.info('✅ Redis connected successfully');
    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis');
    throw error;
  }
}

/**
 * Disconnect from Redis gracefully
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient === null) {
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from Redis');
    if (redisClient !== null) {
      redisClient.disconnect();
    }
    redisClient = null;
  }
}

/**
 * Get the current Redis client instance
 */
export function getRedisClient(): Redis {
  if (redisClient === null) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  if (redisClient.status !== 'ready') {
    throw new Error(
      `Redis client not ready: current status is "${redisClient.status}". Expected "ready".`
    );
  }
  return redisClient;
}
