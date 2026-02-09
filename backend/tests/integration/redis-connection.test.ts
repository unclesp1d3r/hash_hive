import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import {
  checkRedisHealth,
  connectRedis,
  disconnectRedis,
  getRedisClient,
} from '../../src/config/redis';

describe('Redis Connection Integration Tests', () => {
  let redisContainer: StartedRedisContainer;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(
    async () => {
      // Save original environment
      originalEnv = { ...process.env };

      // Start Redis container
      redisContainer = await new RedisContainer('redis:7-alpine').start();
      const redisHost = redisContainer.getHost();
      const redisPort = redisContainer.getPort();

      // Update environment for tests
      process.env['REDIS_HOST'] = redisHost;
      process.env['REDIS_PORT'] = redisPort.toString();
      process.env['REDIS_PASSWORD'] = '';
    },
    60000 // 60 second timeout for container startup
  );

  afterAll(async () => {
    // Cleanup order: services first, then containers
    await disconnectRedis();

    if (redisContainer) {
      await redisContainer.stop();
    }

    // Restore original environment
    process.env = originalEnv;
  });

  afterEach(async () => {
    // Flush all data before disconnecting, if a client is available
    try {
      const client = getRedisClient();
      if (client.status === 'ready') {
        await client.flushall();
      }
    } catch {
      // Client was not initialized; nothing to flush
    }

    await disconnectRedis();
  });

  describe('connectRedis', () => {
    it('should connect to Redis successfully', async () => {
      const client = await connectRedis();

      expect(client).toBeDefined();
      expect(client.status).toBe('ready');
    });

    it('should return existing connection if already connected', async () => {
      const client1 = await connectRedis();
      const client2 = await connectRedis();

      expect(client1).toBe(client2);
    });

    it('should verify connection with PING', async () => {
      const client = await connectRedis();
      const pong = await client.ping();

      expect(pong).toBe('PONG');
    });
  });

  describe('getRedisClient', () => {
    it('should return connected client', async () => {
      await connectRedis();
      const client = getRedisClient();

      expect(client).toBeDefined();
      expect(client.status).toBe('ready');
    });

    it('should throw error if not connected', () => {
      expect(() => getRedisClient()).toThrow('Redis client not initialized');
    });
  });

  describe('checkRedisHealth', () => {
    it('should return healthy status when connected', async () => {
      await connectRedis();
      const health = await checkRedisHealth();

      expect(health.status).toBe('healthy');
      expect(health.latency).toBeDefined();
      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when not connected', async () => {
      const health = await checkRedisHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
    });
  });

  describe('disconnectRedis', () => {
    it('should disconnect gracefully', async () => {
      await connectRedis();
      await disconnectRedis();

      // Should be able to reconnect after disconnect
      const client = await connectRedis();
      expect(client.status).toBe('ready');
    });

    it('should handle disconnect when not connected', async () => {
      await expect(disconnectRedis()).resolves.not.toThrow();
    });
  });

  describe('Redis operations', () => {
    beforeEach(async () => {
      await connectRedis();
      const client = getRedisClient();
      await client.flushdb();
    });

    it('should set and get values', async () => {
      const client = getRedisClient();

      await client.set('test-key', 'test-value');
      const value = await client.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should handle expiration', async () => {
      const client = getRedisClient();

      await client.set('expire-key', 'expire-value', 'EX', 1);
      const value1 = await client.get('expire-key');
      expect(value1).toBe('expire-value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const value2 = await client.get('expire-key');
      expect(value2).toBeNull();
    });

    it('should handle hash operations', async () => {
      const client = getRedisClient();

      await client.hset('test-hash', 'field1', 'value1');
      await client.hset('test-hash', 'field2', 'value2');

      const value1 = await client.hget('test-hash', 'field1');
      const value2 = await client.hget('test-hash', 'field2');
      const all = await client.hgetall('test-hash');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(all).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should handle list operations', async () => {
      const client = getRedisClient();

      await client.rpush('test-list', 'item1', 'item2', 'item3');
      const length = await client.llen('test-list');
      const items = await client.lrange('test-list', 0, -1);

      expect(length).toBe(3);
      expect(items).toEqual(['item1', 'item2', 'item3']);
    });
  });
});
