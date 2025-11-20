import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(code: string, message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

/**
 * Centralized error handling middleware.
 * Formats errors into a consistent structure and logs them appropriately.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = typeof req.id === 'string' && req.id !== '' ? req.id : 'unknown';

  // Log the error
  logger.error(
    {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      requestId,
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body as Record<string, unknown>,
    },
    'Request error'
  );

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle custom application errors
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle MongoDB duplicate key errors
  if (
    err.name === 'MongoServerError' &&
    'code' in err &&
    (err as { code: number }).code === 11000
  ) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'CONFLICT_DUPLICATE_RESOURCE',
        message: 'A resource with this identifier already exists',
        details: 'keyValue' in err ? (err as { keyValue: unknown }).keyValue : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(409).json(errorResponse);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid authentication token',
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(401).json(errorResponse);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(401).json(errorResponse);
    return;
  }

  // Default to 500 Internal Server Error
  const errorResponse: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  res.status(500).json(errorResponse);
};
