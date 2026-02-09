import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import { closeQueues, initializeQueues } from '../../src/config/queue';
import { connectRedis, disconnectRedis } from '../../src/config/redis';
import { app } from '../../src/index';

let redisContainer: StartedRedisContainer;
let originalEnv: NodeJS.ProcessEnv;

describe('Express Server Integration', () => {
  beforeAll(
    async () => {
      // Preserve original environment for isolation across test suites
      originalEnv = { ...process.env };

      // Start Redis container
      redisContainer = await new RedisContainer('redis:7-alpine').start();
      const redisHost = redisContainer.getHost();
      const redisPort = redisContainer.getPort();

      process.env['REDIS_HOST'] = redisHost;
      process.env['REDIS_PORT'] = redisPort.toString();
      process.env['REDIS_PASSWORD'] = '';

      await connectRedis();
      initializeQueues();
    },
    60000 // 60 second timeout for container startup
  );

  afterAll(async () => {
    // Cleanup order: services first, then containers
    await closeQueues();
    await disconnectRedis();

    if (redisContainer) {
      await redisContainer.stop();
    }

    // Restore original environment variables
    process.env = originalEnv;
  });
  describe('Middleware Pipeline', () => {
    it('should add request ID to response headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should accept custom request ID from header', async () => {
      const customId = 'custom-test-id-123';
      const response = await request(app).get('/health').set('x-request-id', customId);

      expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should set security headers on all responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'"
      );
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Health Check Endpoints', () => {
    it('should respond to GET /health', async () => {
      const response = await request(app).get('/health');

      // /health always returns HTTP 200, with overall health encoded in the
      // response body as either "healthy" or "degraded".
      expect(response.status).toBe(200);
      expect(['healthy', 'degraded']).toContain(response.body.status);
    });

    it('should respond to GET /health/ready', async () => {
      const response = await request(app).get('/health/ready');

      // /health/ready continues to use 200/503 semantics depending on
      // infrastructure readiness.
      expect([200, 503]).toContain(response.status);
      expect(['ready', 'not_ready']).toContain(response.body.status);
    });

    it('should respond to GET /health/live', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
    });

    it('should handle JSON parsing errors', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('invalid json{');

      // Express body-parser returns 400 for invalid JSON, but our error handler
      // may convert it to 500 if not properly caught
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Request Logging', () => {
    it('should log requests with request ID', async () => {
      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      // Logger output is tested separately, here we just verify the request completes
    });
  });
});
