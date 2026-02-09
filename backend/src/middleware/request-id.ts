import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to generate and attach a unique request ID to each request.
 * The request ID is used for tracing and correlating logs across the request lifecycle.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check if request ID is provided in header, otherwise generate a new one
  const { 'x-request-id': requestIdHeader } = req.headers;
  const requestId =
    typeof requestIdHeader === 'string' && requestIdHeader !== '' ? requestIdHeader : randomUUID();

  // Attach request ID to request object
  req.id = requestId;

  // Set response header for client-side tracing
  res.setHeader('x-request-id', requestId);

  next();
};

// Extend Express Request type to include id property
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
