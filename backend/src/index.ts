import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initializeQueues, closeQueues } from './config/queue';
import { requestIdMiddleware } from './middleware/request-id';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { errorHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health';

// Create Express application
const app = express();

// Request ID middleware (must be first to ensure all logs have request ID)
app.use(requestIdMiddleware);

// Request logging with Pino
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err != null) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.use('/health', healthRouter);

// API routes will be added here in subsequent tasks
// app.use('/api/v1/web', webRouter);
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
      process.exit(1);
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
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error({ error }, 'Error during graceful shutdown');
          process.exit(1);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
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
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });
}

export { app };
