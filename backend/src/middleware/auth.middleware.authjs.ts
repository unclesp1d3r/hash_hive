import type { Request, Response, NextFunction } from 'express';
import { getSession } from '@auth/express';
import { authConfig } from '../config/auth.config';
import { AppError } from './error-handler';
import { logger } from '../utils/logger';
import { User as UserModel, type IUser } from '../models/user.model';
import type { User, AuthTokenPayload } from '../../../shared/src/types';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthTokenExpiredError, AuthTokenInvalidError } from '../utils/auth-errors';

const HTTP_UNAUTHORIZED = 401;
const BEARER_PREFIX_LENGTH = 7;

/**
 * Maps a Mongoose IUser document to a User object for request context
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
 * Authenticate session from Auth.js
 * Uses getSession from @auth/express to validate session and attach user to request
 */
export const authenticateSession = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await getSession(req, authConfig);

    if (session?.user === undefined) {
      throw new AppError('AUTH_SESSION_INVALID', 'Session not found or invalid', HTTP_UNAUTHORIZED);
    }

    const { user: sessionUser } = session;
    // Get user from database to ensure status is active
    const user = await UserModel.findById(sessionUser.id);
    if (user === null) {
      throw new AppError('AUTH_SESSION_INVALID', 'User not found', HTTP_UNAUTHORIZED);
    }
    if (user.status !== 'active') {
      throw new AppError('AUTH_SESSION_INVALID', 'User is inactive', HTTP_UNAUTHORIZED);
    }

    // Use roles from session (already aggregated in callback)
    const roles = (sessionUser as { roles?: string[] }).roles ?? [];

    // Attach user to request with roles
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.user = mapUserToRequestUser(user, roles);

    // Store session in res.locals for access in route handlers
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern
    _res.locals['session'] = session;

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
 * Extract and validate JWT token from Authorization header
 */
function extractJWTToken(authHeader: string | undefined): string {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      'AUTH_TOKEN_INVALID',
      'Missing or invalid authorization header',
      HTTP_UNAUTHORIZED
    );
  }
  return authHeader.substring(BEARER_PREFIX_LENGTH);
}

/**
 * Verify JWT token and return payload
 */
function verifyJWTToken(token: string): AuthTokenPayload {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- jwt.verify returns unknown, we validate structure
    return jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthTokenExpiredError('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthTokenInvalidError('Invalid token');
    }
    throw error;
  }
}

/**
 * Authenticate JWT token from Authorization header
 * Supports both Auth.js JWT and legacy JWT tokens
 */
export const authenticateJWT = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
    const authHeader = req.headers.authorization;
    const token = extractJWTToken(authHeader);
    const payload = verifyJWTToken(token);

    // Get user from database
    const { userId } = payload;
    const user = await UserModel.findById(userId);

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
 * Try to authenticate via session (for optional auth)
 */
async function trySessionAuthOptional(req: Request, res: Response): Promise<boolean> {
  try {
    const session = await getSession(req, authConfig);
    if (!session?.user) {
      return false;
    }

    const { user: sessionUser } = session;
    const user = await UserModel.findById(sessionUser.id);
    if (user === null || user.status !== 'active') {
      return false;
    }

    const roles = (sessionUser as { roles?: string[] }).roles ?? [];
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.user = mapUserToRequestUser(user, roles);
    // eslint-disable-next-line no-param-reassign -- Express middleware pattern
    res.locals['session'] = session;
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to authenticate via JWT (for optional auth)
 */
async function tryJWTAuthOptional(req: Request): Promise<boolean> {
  try {
    const { authorization: authHeader } = req.headers;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(BEARER_PREFIX_LENGTH);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- jwt.verify returns unknown, we validate structure
    const payload = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
    const { userId } = payload;
    const user = await UserModel.findById(userId);
    if (user === null || user.status !== 'active') {
      return false;
    }

    // eslint-disable-next-line no-param-reassign -- Express middleware pattern requires mutating req
    req.user = mapUserToRequestUser(user, payload.roles);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optional authentication - attempts authentication but doesn't fail if not authenticated
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try session first
    if (await trySessionAuthOptional(req, res)) {
      next();
      return;
    }

    // Try JWT
    if (await tryJWTAuthOptional(req)) {
      next();
      return;
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
