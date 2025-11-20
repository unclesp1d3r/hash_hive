import request from 'supertest';
import express from 'express';
import { healthRouter } from '../../src/routes/health';

describe('Health Check Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use('/health', healthRouter);
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('node');
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('unit', 'MB');
    });

    it('should return valid timestamp in ISO format', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should return positive uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 with readiness status', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('server', 'ok');
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 with liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
