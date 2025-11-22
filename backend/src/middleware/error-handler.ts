/* eslint-disable complexity, @typescript-eslint/init-declarations -- Centralized error handler trades off complexity for having one authoritative place; safeBody is initialized via branches */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const MONGO_DUPLICATE_KEY_CODE = 11000;

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode = HTTP_INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
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

  // Safely serialize req.body for logging
  let safeBody: unknown;
  if (req.body === null || req.body === undefined) {
    safeBody = undefined;
  } else if (typeof req.body === 'object') {
    // Handle objects and arrays - check if JSON-serializable
    try {
      JSON.stringify(req.body);
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct assignment keeps logging logic simple
      safeBody = req.body;
    } catch {
      safeBody = '[unserializable body]';
    }
  } else {
    // Handle primitives (string, number, boolean)
    safeBody = String(req.body);
  }

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
      body: safeBody,
    },
    'Request error'
  );

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    res.status(HTTP_BAD_REQUEST).json(errorResponse);
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Narrowing Mongo error shape based on known driver fields
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY_CODE
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

    res.status(HTTP_CONFLICT).json(errorResponse);
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

    res.status(HTTP_UNAUTHORIZED).json(errorResponse);
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

    res.status(HTTP_UNAUTHORIZED).json(errorResponse);
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

  res.status(HTTP_INTERNAL_SERVER_ERROR).json(errorResponse);
};
