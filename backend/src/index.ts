import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import lusca from 'lusca';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './db';
import { connectRedis, disconnectRedis } from './db/redis';
import { initializeQueues, closeQueues } from './config/queue';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';
import { webRouter } from './routes';

// HTTP status / exit code constants to avoid magic numbers
const HTTP_STATUS_SERVER_ERROR_THRESHOLD = 500;
const HTTP_STATUS_CLIENT_ERROR_THRESHOLD = 400;
const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_FAILURE = 1;
const FORCE_SHUTDOWN_TIMEOUT_MS = 10000;

// Create Express application
const app = express();

// Request ID middleware (must be first to ensure all logs have request ID)
app.use(requestIdMiddleware);

// Request logging with Pino
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      const hasError = err instanceof Error;
      if (res.statusCode >= HTTP_STATUS_SERVER_ERROR_THRESHOLD || hasError) return 'error';
      if (res.statusCode >= HTTP_STATUS_CLIENT_ERROR_THRESHOLD) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration',
    },
    serializers: {
      req: (req: express.Request) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        remoteAddress: req.ip,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.socket can be undefined in test environments (supertest)
        remotePort: req.socket?.remotePort,
      }),
      res: (res: express.Response) => ({
        statusCode: res.statusCode,
      }),
    },
  })
);

// CORS configuration - Agent API has no restrictions, Web API is restricted
app.use(
  cors((req, callback) => {
    const isAgentApi = req.path.startsWith('/api/v1/agent');

    if (isAgentApi) {
      // No CORS restrictions for Agent API (distributed workers from any origin)
      callback(null, {
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-api-version', 'x-request-id'],
        exposedHeaders: ['x-request-id'],
      });
    } else {
      // Restricted CORS for Web API (browser-based UI only)
      callback(null, {
        origin: config.server.isDevelopment
          ? ['http://localhost:3000', 'http://localhost:3001']
          : config.server.baseUrl,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-api-version', 'x-request-id'],
        exposedHeaders: ['x-request-id'],
      });
    }
  })
);

// Security headers
app.use(securityHeadersMiddleware);

// Cookie parsing middleware
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF protection middleware
// Note: CSRF protection is NOT required for agent API endpoints (/api/v1/agent)
// because agent API uses token-based authentication (not cookie-based), making it
// immune to CSRF attacks. CSRF protection only applies to browser-based requests
// to /api/v1/web that rely on cookie-based sessions.
const csrfMiddleware = lusca.csrf();
app.use((req, res, next) => {
  // Skip CSRF protection for agent API endpoints
  if (req.path.startsWith('/api/v1/agent')) {
    next();
    return;
  }
  csrfMiddleware(req, res, next);
});

// Health check endpoint
app.use('/health', healthRouter);

// API routes
app.use('/api/v1/web', webRouter);
// app.use('/api/v1/agent', agentRouter);
// app.use('/api/v1/control', controlRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server only if this file is run directly (not imported)
if (require.main === module) {
  // Initialize all infrastructure before starting server
  Promise.all([connectDatabase(), connectRedis()])
    .then(() => {
      // Initialize BullMQ queues after Redis is connected
      initializeQueues();

      const server = app.listen(config.server.port, () => {
        logger.info(
          {
            port: config.server.port,
            env: config.server.env,
            baseUrl: config.server.baseUrl,
          },
          '🚀 HashHive Backend started successfully'
        );
      });

      // Store server reference for graceful shutdown
      setupGracefulShutdown(server);
    })
    .catch((error: unknown) => {
      logger.fatal({ error }, 'Failed to start server');
      process.exit(EXIT_CODE_FAILURE);
    });
}

function setupGracefulShutdown(server: ReturnType<typeof app.listen>): void {
  // Graceful shutdown handling
  const gracefulShutdown = (signal: string): void => {
    logger.info({ signal }, 'Received shutdown signal, closing server gracefully...');

    server.close(() => {
      logger.info('HTTP server closed');

      // Close all resources in order
      Promise.all([closeQueues(), disconnectRedis(), disconnectDatabase()])
        .then(() => {
          logger.info('All connections closed');
          logger.info('Graceful shutdown complete');
          process.exit(EXIT_CODE_SUCCESS);
        })
        .catch((error: unknown) => {
          logger.error({ error }, 'Error during graceful shutdown');
          process.exit(EXIT_CODE_FAILURE);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(EXIT_CODE_FAILURE);
    }, FORCE_SHUTDOWN_TIMEOUT_MS);
  };

  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(EXIT_CODE_FAILURE);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    process.exit(EXIT_CODE_FAILURE);
  });
}

export { app };
