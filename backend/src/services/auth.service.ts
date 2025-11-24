import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { User, type IUser } from '../models/user.model';
import { Session } from '../models/session.model';
import { getRedisClient } from '../db/redis';
import { aggregateUserRoles } from '../utils/role-aggregator';
import { AuthTokenExpiredError, AuthTokenInvalidError } from '../utils/auth-errors';
import type { AuthTokenPayload } from '../../../shared/src/types';

const SESSION_ID_BYTES = 32;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DEFAULT_TOKEN_EXPIRATION_DAYS = 7;
const ARRAY_INDEX_ZERO = 0;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Service class pattern for static methods
export class AuthService {
  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password_hash +password_requires_upgrade'
    );

    if (user === null) {
      logger.warn({ email }, 'Login attempt with invalid email');
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn({ email, userId: user._id.toString() }, 'Login attempt with invalid password');
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'active') {
      logger.warn({ email, userId: user._id.toString() }, 'Login attempt for disabled user');
      throw new Error('Account is disabled');
    }

    // Flag weak passwords for upgrade (does not block login). Strong threshold distinct from minimum login length.
    const STRONG_MIN_PASSWORD_LENGTH = 12;
    if (password.length < STRONG_MIN_PASSWORD_LENGTH && user.password_requires_upgrade !== true) {
      user.password_requires_upgrade = true;
      await user.save();
      logger.warn(
        { userId: user._id.toString(), email, length: password.length },
        'User logged in with weak password; flagged for upgrade'
      );
    }

    // Get user roles from projects across all projects
    const roles = await aggregateUserRoles(user._id.toString());

    // Generate JWT token
    const token = this.generateToken(user._id.toString(), roles);

    // Update last login timestamp only after successful role aggregation and token generation
    user.last_login_at = new Date();
    await user.save();

    logger.info({ email, userId: user._id.toString() }, 'User logged in successfully');

    return { user, token };
  }

  /**
   * Generate JWT token
   */
  static generateToken(userId: string, roles: string[]): string {
    const now = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    const payload: AuthTokenPayload = {
      userId,
      roles,
      iat: now,
      exp: now + this.getTokenExpirationSeconds(),
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Validate JWT token
   */
  static validateToken(token: string): AuthTokenPayload {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- jwt.verify returns unknown, we validate structure
      const decoded = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
      return decoded;
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
   * Create session and store in database and Redis
   */
  static async createSession(userId: string): Promise<string> {
    const sessionId = crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + config.auth.sessionMaxAge);

    // Store in MongoDB
    await Session.create({
      session_id: sessionId,
      user_id: userId,
      data: {},
      expires_at: expiresAt,
    });

    // Store in Redis with rollback on failure
    try {
      const redis = getRedisClient();
      await redis.setex(
        `session:${sessionId}`,
        Math.floor(config.auth.sessionMaxAge / MILLISECONDS_PER_SECOND),
        userId
      );
    } catch (redisError) {
      logger.error(
        { error: redisError, userId, sessionId },
        'Failed to store session in Redis, rolling back MongoDB session'
      );

      // Rollback: Delete the MongoDB session
      try {
        await Session.deleteOne({ session_id: sessionId });
        logger.info({ sessionId }, 'Successfully rolled back MongoDB session after Redis failure');
      } catch (rollbackError) {
        logger.error(
          { error: rollbackError, sessionId },
          'Failed to rollback MongoDB session after Redis failure - orphaned session may exist'
        );
      }

      // Re-throw the original Redis error
      const errorMessage = redisError instanceof Error ? redisError.message : 'Redis error';
      const sessionError = new Error(`Failed to create session: ${errorMessage}`);
      sessionError.cause = redisError;
      throw sessionError;
    }

    logger.info({ userId, sessionId }, 'Session created');

    return sessionId;
  }

  /**
   * Validate session from Redis and database
   */
  static async validateSession(sessionId: string): Promise<IUser | null> {
    try {
      // Check Redis first
      const redis = getRedisClient();
      const userId = await redis.get(`session:${sessionId}`);

      if (userId === null) {
        return null;
      }

      // Verify session exists in database
      const session = await Session.findOne({
        session_id: sessionId,
        expires_at: { $gt: new Date() },
      });

      if (session === null) {
        return null;
      }

      // Get user
      const user = await User.findById(userId);
      if (user === null) {
        return null;
      }
      if (user.status !== 'active') {
        return null;
      }

      return user;
    } catch (error) {
      logger.error({ error, sessionId }, 'Error validating session');
      return null;
    }
  }

  /**
   * Logout - remove session from Redis and database
   */
  static async logout(sessionId: string): Promise<void> {
    try {
      // Remove from Redis
      const redis = getRedisClient();
      await redis.del(`session:${sessionId}`);

      // Remove from database
      await Session.deleteOne({ session_id: sessionId });

      logger.info({ sessionId }, 'Session removed');
    } catch (error) {
      logger.error({ error, sessionId }, 'Error during logout');
      throw error;
    }
  }

  /**
   * Parse and validate expiration time string
   */
  private static parseExpirationString(expiresIn: string): { value: number; unit: string } | null {
    const RADIX = 10;
    const normalized = expiresIn.trim().toLowerCase();

    if (normalized.length === ARRAY_INDEX_ZERO) {
      return null;
    }

    const match = /^(\d+)([dhms])$/.exec(normalized);
    if (match === null) {
      return null;
    }

    const [, numericPart, unit] = match;

    if (numericPart === undefined || unit === undefined) {
      return null;
    }
    const value = parseInt(numericPart, RADIX);

    if (isNaN(value) || value <= ARRAY_INDEX_ZERO) {
      return null;
    }

    return { value, unit };
  }

  /**
   * Calculate seconds from time value and unit
   */
  private static calculateSeconds(value: number, unit: string): number {
    switch (unit) {
      case 'd':
        return value * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
      case 'h':
        return value * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
      case 'm':
        return value * SECONDS_PER_MINUTE;
      case 's':
        return value;
      default:
        return (
          DEFAULT_TOKEN_EXPIRATION_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE
        );
    }
  }

  /**
   * Get token expiration in seconds
   */
  private static getTokenExpirationSeconds(): number {
    const DEFAULT_SECONDS =
      DEFAULT_TOKEN_EXPIRATION_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;

    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
    const expiresIn = config.auth.jwtExpiresIn;

    // Validate and normalize input
    if (expiresIn.length === ARRAY_INDEX_ZERO || typeof expiresIn !== 'string') {
      logger.warn({ expiresIn }, 'JWT expiration config is missing or not a string, using default');
      return DEFAULT_SECONDS;
    }

    const parsed = this.parseExpirationString(expiresIn);

    if (parsed === null) {
      logger.warn(
        { expiresIn },
        'JWT expiration config has invalid format (expected: <number><unit> where unit is d/h/m/s), using default'
      );
      return DEFAULT_SECONDS;
    }

    return this.calculateSeconds(parsed.value, parsed.unit);
  }
}
