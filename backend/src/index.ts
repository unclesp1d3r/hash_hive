import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
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

// CORS configuration
app.use(
  cors({
    origin: config.server.isDevelopment
      ? ['http://localhost:3000', 'http://localhost:3001']
      : config.server.baseUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-api-version', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
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

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string): void => {
    logger.info({ signal }, 'Received shutdown signal, closing server gracefully...');

    server.close(() => {
      logger.info('HTTP server closed');

      // Close database connections and other resources here in subsequent tasks
      // await mongoose.connection.close();
      // await redis.quit();

      logger.info('Graceful shutdown complete');
      process.exit(0);
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
