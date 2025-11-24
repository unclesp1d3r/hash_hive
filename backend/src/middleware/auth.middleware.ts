import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { logger } from '../utils/logger';
import { AuthService } from '../services/auth.service';
import { aggregateUserRoles } from '../utils/role-aggregator';
import { AuthTokenExpiredError, AuthTokenInvalidError } from '../utils/auth-errors';
import { User as UserModel, type IUser } from '../models/user.model';
import type { User } from '../../../shared/src/types';

const HTTP_UNAUTHORIZED = 401;
const BEARER_PREFIX_LENGTH = 7;

/**
 * Maps a Mongoose IUser document to a User object for request context
 * @param user - The Mongoose user document
 * @param roles - Array of user roles
 * @returns User object for request context
 */
function mapUserToRequestUser(user: IUser, roles: string[]): User {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    status: user.status,
    last_login_at: user.last_login_at ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
    roles,
  };
}

/**
 * Authenticate JWT token from Authorization header
 */
export const authenticateJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
    const authHeader = req.headers.authorization;
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Optional chaining handles undefined
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(
        'AUTH_TOKEN_INVALID',
        'Missing or invalid authorization header',
        HTTP_UNAUTHORIZED
      );
    }

    const token = authHeader.substring(BEARER_PREFIX_LENGTH);
    const payload = AuthService.validateToken(token);

    // Get user from database
    const user = await UserModel.findById(payload.userId);

    if (user === null) {
      throw new AppError('AUTH_TOKEN_INVALID', 'User not found', HTTP_UNAUTHORIZED);
    }
    if (user.status !== 'active') {
      throw new AppError('AUTH_TOKEN_INVALID', 'User is inactive', HTTP_UNAUTHORIZED);
    }

    // Attach user to request with roles from JWT token
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.user = mapUserToRequestUser(user, payload.roles);

    logger.info(
      { userId: user._id.toString(), requestId: req.id },
      'JWT authentication successful'
    );
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof AuthTokenExpiredError) {
      throw new AppError(
        'AUTH_TOKEN_EXPIRED',
        'Authentication token has expired',
        HTTP_UNAUTHORIZED
      );
    }

    if (error instanceof AuthTokenInvalidError) {
      logger.warn({ error, requestId: req.id }, 'JWT authentication failed - invalid token');
      throw new AppError('AUTH_TOKEN_INVALID', 'Invalid authentication token', HTTP_UNAUTHORIZED);
    }

    logger.warn({ error, requestId: req.id }, 'JWT authentication failed');
    throw new AppError('AUTH_TOKEN_INVALID', 'Invalid authentication token', HTTP_UNAUTHORIZED);
  }
};

/**
 * Authenticate session from cookie
 */
export const authenticateSession = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const cookies = req.cookies as { sessionId?: string } | undefined;
    const sessionId = cookies?.sessionId;
    if (sessionId === undefined || sessionId === '') {
      throw new AppError('AUTH_SESSION_INVALID', 'Session cookie not found', HTTP_UNAUTHORIZED);
    }

    const user = await AuthService.validateSession(sessionId);
    if (user === null) {
      throw new AppError('AUTH_SESSION_INVALID', 'Invalid or expired session', HTTP_UNAUTHORIZED);
    }

    // Aggregate user roles from projects
    const roles = await aggregateUserRoles(user._id.toString());

    // Attach user to request with roles
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.user = mapUserToRequestUser(user, roles);

    logger.info(
      { userId: user._id.toString(), requestId: req.id },
      'Session authentication successful'
    );
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.warn({ error, requestId: req.id }, 'Session authentication failed');
    throw new AppError('AUTH_SESSION_INVALID', 'Invalid session', HTTP_UNAUTHORIZED);
  }
};

/**
 * Optional authentication - attempts authentication but doesn't fail if not authenticated
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try session first
    const cookies = req.cookies as { sessionId?: string } | undefined;
    const sessionId = cookies?.sessionId;
    if (sessionId !== undefined && sessionId !== '') {
      const user = await AuthService.validateSession(sessionId);
      if (user !== null) {
        const roles = await aggregateUserRoles(user._id.toString());
        // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
        req.user = mapUserToRequestUser(user, roles);
        next();
        return;
      }
    }

    // Try JWT
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
    const authHeader = req.headers.authorization;
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Optional chaining handles undefined
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(BEARER_PREFIX_LENGTH);
      const payload = AuthService.validateToken(token);
      const user = await UserModel.findById(payload.userId);
      if (user !== null && user.status === 'active') {
        // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
        req.user = mapUserToRequestUser(user, payload.roles);
        next();
        return;
      }
    }

    // No authentication found, continue without user
    next();
  } catch (error) {
    // Log authentication errors at debug level and continue without authentication
    logger.debug(
      { error, requestId: req.id },
      'Optional auth middleware error, proceeding unauthenticated'
    );
    next();
  }
};
