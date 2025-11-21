import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config';
import { isMongoConnected } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { checkQueueHealth } from '../config/queue';

export const healthRouter = Router();

/**
 * Health check endpoint
 * Returns basic system health information
 *
 * @route GET /health
 * @returns {object} 200 - Health status information
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  void (async () => {
    const mongoConnected = isMongoConnected();
    const redisHealth = await checkRedisHealth();
    const queueHealth = await checkQueueHealth();

    const allHealthy =
      mongoConnected && redisHealth.status === 'healthy' && queueHealth.status === 'healthy';
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    const healthInfo = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.env,
      version: process.env['npm_package_version'] ?? '1.0.0',
      node: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      database: {
        mongodb: mongoConnected ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
      },
      redis: {
        status: redisHealth.status,
        latency: redisHealth.latency,
        error: redisHealth.error,
      },
      queues: {
        status: queueHealth.status,
        metrics: queueHealth.queues,
        error: queueHealth.error,
      },
    };

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(healthInfo);
  })();
});

/**
 * Readiness check endpoint
 * Checks if the service is ready to accept traffic
 *
 * @route GET /health/ready
 * @returns {object} 200 - Readiness status
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  void (async () => {
    const mongoConnected = isMongoConnected();
    const redisHealth = await checkRedisHealth();
    const queueHealth = await checkQueueHealth();

    // Service is ready only if all critical infrastructure is healthy
    const isReady =
      mongoConnected && redisHealth.status === 'healthy' && queueHealth.status === 'healthy';

    const readinessInfo = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        server: 'ok',
        mongodb: mongoConnected ? 'ok' : 'failed',
        redis: redisHealth.status === 'healthy' ? 'ok' : 'failed',
        queues: queueHealth.status === 'healthy' ? 'ok' : 'failed',
        // storage: 'ok', // Will be added in task 2.4
      },
    };

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(readinessInfo);
  })();
});

/**
 * Liveness check endpoint
 * Simple check to verify the process is alive
 *
 * @route GET /health/live
 * @returns {object} 200 - Liveness status
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});
