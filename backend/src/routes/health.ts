import { Router } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config';

export const healthRouter = Router();

/**
 * Health check endpoint
 * Returns basic system health information
 *
 * @route GET /health
 * @returns {object} 200 - Health status information
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  const healthInfo = {
    status: 'healthy',
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
  };

  res.status(200).json(healthInfo);
});

/**
 * Readiness check endpoint
 * Can be extended to check database and other service connections
 *
 * @route GET /health/ready
 * @returns {object} 200 - Readiness status
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  // In future tasks, add checks for:
  // - MongoDB connection
  // - Redis connection
  // - S3/MinIO connection

  const readinessInfo = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      server: 'ok',
      // mongodb: 'ok',
      // redis: 'ok',
      // storage: 'ok',
    },
  };

  res.status(200).json(readinessInfo);
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
