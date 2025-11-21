/* eslint-disable @typescript-eslint/no-magic-numbers -- Health metrics include standard HTTP codes and 1024-based memory units */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { config } from '../config';
import { isMongoConnected } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { checkQueueHealth } from '../config/queue';
import { logger } from '../utils/logger';

export const healthRouter = Router();

/**
 * Health check endpoint
 * Returns basic system health information
 *
 * @route GET /health
 * @returns {object} 200 - Health status information
 */
healthRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mongoConnected = isMongoConnected();
    const redisHealth = await checkRedisHealth();
    const queueHealth = await checkQueueHealth();

    const allHealthy =
      mongoConnected && redisHealth.status === 'healthy' && queueHealth.status === 'healthy';
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    const BYTES_IN_MB = 1024 * 1024;

    const healthInfo = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.env,
      version: process.env['npm_package_version'] ?? '1.0.0',
      node: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / BYTES_IN_MB),
        total: Math.round(process.memoryUsage().heapTotal / BYTES_IN_MB),
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

    const HTTP_OK = 200;
    const HTTP_SERVICE_UNAVAILABLE = 503;
    const statusCode = allHealthy ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;
    res.status(statusCode).json(healthInfo);
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    next(err);
  }
});

/**
 * Readiness check endpoint
 * Checks if the service is ready to accept traffic
 *
 * @route GET /health/ready
 * @returns {object} 200 - Readiness status
 */
healthRouter.get('/ready', async (_req: Request, res: Response, next: NextFunction) => {
  try {
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

    const HTTP_OK = 200;
    const HTTP_SERVICE_UNAVAILABLE = 503;
    const statusCode = isReady ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE;
    res.status(statusCode).json(readinessInfo);
  } catch (err) {
    logger.error({ err }, 'Readiness check failed');
    next(err);
  }
});

/**
 * Liveness check endpoint
 * Simple check to verify the process is alive
 *
 * @route GET /health/live
 * @returns {object} 200 - Liveness status
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  const HTTP_OK = 200;
  res.status(HTTP_OK).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});
