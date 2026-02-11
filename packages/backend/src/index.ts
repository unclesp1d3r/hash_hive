import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { checkMinioHealth } from './config/storage.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { securityHeaders } from './middleware/security-headers.js';
import { getQueueManager, setQueueManager } from './queue/context.js';
import { QueueManager } from './queue/manager.js';
import { agentRoutes } from './routes/agent/index.js';
import { dashboardAgentRoutes } from './routes/dashboard/agents.js';
import { authRoutes } from './routes/dashboard/auth.js';
import { campaignRoutes } from './routes/dashboard/campaigns.js';
import { createEventRoutes } from './routes/dashboard/events.js';
import { hashRoutes } from './routes/dashboard/hashes.js';
import { projectRoutes } from './routes/dashboard/projects.js';
import { resourceRoutes } from './routes/dashboard/resources.js';
import { taskRoutes } from './routes/dashboard/tasks.js';
import type { AppEnv } from './types.js';

const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono<AppEnv>();
const eventRoutes = createEventRoutes(upgradeWebSocket);

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

app.get('/health', async (c) => {
  const qm = getQueueManager();
  const [redisHealth, minioHealth] = await Promise.all([
    qm ? qm.getHealth() : Promise.resolve({ status: 'disconnected' as const, queues: {} }),
    checkMinioHealth(),
  ]);

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      redis: redisHealth,
      minio: minioHealth,
    },
  });
});

// ─── Route Mounts ────────────────────────────────────────────────────

app.route('/api/v1/dashboard/auth', authRoutes);
app.route('/api/v1/dashboard/projects', projectRoutes);
app.route('/api/v1/dashboard/agents', dashboardAgentRoutes);
app.route('/api/v1/dashboard/resources', resourceRoutes);
app.route('/api/v1/dashboard/hashes', hashRoutes);
app.route('/api/v1/dashboard/campaigns', campaignRoutes);
app.route('/api/v1/dashboard/tasks', taskRoutes);
app.route('/api/v1/dashboard/events', eventRoutes);

app.route('/api/v1/agent', agentRoutes);

// ─── Error Handler ──────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

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

// ─── Queue Manager Init (non-blocking) ─────────────────────────────

const queueManager = new QueueManager();
setQueueManager(queueManager);
queueManager.init().catch((err) => {
  logger.error({ err }, 'Queue manager init failed — queues unavailable');
});

// ─── Graceful Shutdown ──────────────────────────────────────────────

async function handleShutdown(signal: string) {
  logger.info({ signal }, 'received shutdown signal, closing gracefully');
  const qm = getQueueManager();
  if (qm) {
    await qm.shutdown();
  }
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default {
  port: env.PORT,
  fetch: app.fetch,
  websocket,
};

export { app, websocket };
