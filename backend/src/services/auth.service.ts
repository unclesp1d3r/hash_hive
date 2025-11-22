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

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Service class pattern for static methods
export class AuthService {
  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password_hash');

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

    // Update last login timestamp
    user.last_login_at = new Date();
    await user.save();

    // Get user roles from projects across all projects
    const roles = await aggregateUserRoles(user._id.toString());

    // Generate JWT token
    const token = this.generateToken(user._id.toString(), roles);

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

    // Store in Redis
    const redis = getRedisClient();
    await redis.setex(
      `session:${sessionId}`,
      Math.floor(config.auth.sessionMaxAge / MILLISECONDS_PER_SECOND),
      userId
    );

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
   * Get token expiration in seconds
   */
  private static getTokenExpirationSeconds(): number {
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- Direct property access is clearer here
    const expiresIn = config.auth.jwtExpiresIn;
    const SLICE_END_INDEX = -1;
    const RADIX = 10;
    const SLICE_START_INDEX = 0;

    if (expiresIn.endsWith('d')) {
      const days = parseInt(expiresIn.slice(SLICE_START_INDEX, SLICE_END_INDEX), RADIX);
      return days * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
    }
    if (expiresIn.endsWith('h')) {
      const hours = parseInt(expiresIn.slice(SLICE_START_INDEX, SLICE_END_INDEX), RADIX);
      return hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
    }
    if (expiresIn.endsWith('m')) {
      const minutes = parseInt(expiresIn.slice(SLICE_START_INDEX, SLICE_END_INDEX), RADIX);
      return minutes * SECONDS_PER_MINUTE;
    }
    // Default to 7 days
    return DEFAULT_TOKEN_EXPIRATION_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
  }
}
