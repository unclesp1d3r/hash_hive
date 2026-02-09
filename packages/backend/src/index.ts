import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { securityHeaders } from './middleware/security-headers.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

// ─── Global Middleware ──────────────────────────────────────────────

app.use('*', requestId);
app.use('*', securityHeaders);
app.use('*', requestLogger);
app.use(
  '*',
  cors({
    origin: env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'],
    credentials: true,
  })
);

// ─── Health Check ───────────────────────────────────────────────────

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
);

// ─── Route Mounts (populated in later tasks) ────────────────────────

// app.route('/api/v1/agent', agentRoutes);
// app.route('/api/v1/dashboard', dashboardRoutes);

// ─── Error Handler ──────────────────────────────────────────────────

app.onError((err, c) => {
  const reqId = c.get('requestId');
  logger.error({ err, requestId: reqId, path: c.req.path }, 'unhandled error');

  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
        timestamp: new Date().toISOString(),
        requestId: reqId,
      },
    },
    500
  );
});

// ─── Not Found Handler ──────────────────────────────────────────────

app.notFound((c) =>
  c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        timestamp: new Date().toISOString(),
      },
    },
    404
  )
);

// ─── Start Server ───────────────────────────────────────────────────

logger.info({ port: env.PORT, env: env.NODE_ENV }, 'starting server');

export default {
  port: env.PORT,
  fetch: app.fetch,
};

export { app };
