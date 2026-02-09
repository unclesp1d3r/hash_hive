/* istanbul ignore file */
/**
 * Middleware index file
 *
 * This file exports all middleware functions for convenient importing.
 */

// Authentication middleware
export { authenticateJWT, authenticateSession, optionalAuth } from './auth.middleware';

// Authorization middleware
export {
  hasPermission,
  requireProjectAccess,
  requireProjectRole,
  requireRole,
} from './authz.middleware';

// Error handling
export { AppError, errorHandler } from './error-handler';

// Request ID
export { requestIdMiddleware } from './request-id';

// Security headers
export { securityHeadersMiddleware } from './security-headers';
