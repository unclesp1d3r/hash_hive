/**
 * Middleware index file
 *
 * This file exports all middleware functions for convenient importing.
 */

// Authentication middleware
export { authenticateJWT, authenticateSession, optionalAuth } from './auth.middleware.authjs';

// Authorization middleware
export {
  requireRole,
  requireProjectAccess,
  requireProjectRole,
  hasPermission,
} from './authz.middleware.authjs';

// Error handling
export { errorHandler, AppError } from './error-handler';

// Request ID
export { requestIdMiddleware } from './request-id';

// Security headers
export { securityHeadersMiddleware } from './security-headers';
