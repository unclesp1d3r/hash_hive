import { createMiddleware } from 'hono/factory';
import { logger } from '../config/logger.js';
import type { AppEnv } from '../types.js';

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');

  logger.info({ method, path, requestId }, 'request started');

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info({ method, path, status, duration, requestId }, 'request completed');
});
