import type { Adapter } from '@auth/core/adapters';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { AuthConfig } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import * as crypto from 'node:crypto';
import { mongoose } from '../db';
import { User } from '../models/user.model';
import { ProjectService } from '../services/project.service';
import { config } from './index';
import { logger } from '../utils/logger';

const MS_PER_SECOND = 1000;
const SESSION_TOKEN_BYTES = 32;

/**
 * Collects all role names assigned to a user across every project and returns them without duplicates.
 *
 * @returns An array of unique role strings assigned to the user across all projects.
 */
async function aggregateUserRoles(userId: string): Promise<string[]> {
  const projects = await ProjectService.getUserProjects(userId);

  // Collect roles from all projects in parallel
  const roleArrays = await Promise.all(
    projects.map(
      async (project) => await ProjectService.getUserRolesInProject(userId, project._id.toString())
    )
  );
  return Array.from(new Set(roleArrays.flat()));
}

/**
 * Creates a database session for Credentials provider authentication.
 * Auth.js does not auto-create DB sessions for Credentials logins with database strategy.
 *
 * @param adapter - MongoDB adapter instance
 * @param userId - User ID to create session for
 */
async function createCredentialsSession(adapter: Adapter, userId: string): Promise<void> {
  if (typeof adapter.createSession !== 'function') {
    logger.warn({ userId }, 'MongoDB adapter createSession method not available');
    return;
  }

  try {
    // Generate a secure session token (base64url encoding for URL-safe cookies)
    const sessionToken = crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    
    // Calculate session expiration based on configured max age
    const expires = new Date(Date.now() + config.auth.sessionMaxAge);
    
    // Create session via adapter - this ensures the session exists in the database
    // so that the session callback receives the user object for role aggregation
    await adapter.createSession({
      sessionToken,
      userId,
      expires,
    });
    
    logger.info({ userId }, 'Database session created for Credentials login');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create database session in authorize callback');
    // Continue even if session creation fails - but session callback may not receive user
    // This could cause role aggregation to be skipped
  }
}

/**
 * Validates user password and updates user record if needed.
 *
 * @param user - User document from database
 * @param password - Plain text password to validate
 * @returns true if password is valid, false otherwise
 */
async function validateUserPassword(user: InstanceType<typeof User>, password: string): Promise<boolean> {
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logger.warn(
      { email: user.email, userId: user._id.toString() },
      'Login attempt with invalid password'
    );
    return false;
  }

  if (user.status !== 'active') {
    logger.warn({ email: user.email, userId: user._id.toString() }, 'Login attempt for disabled user');
    return false;
  }

  // Flag weak passwords for upgrade (does not block login)
  const STRONG_MIN_PASSWORD_LENGTH = 12;
  if (
    password.length < STRONG_MIN_PASSWORD_LENGTH &&
    user.password_requires_upgrade !== true
  ) {
    // eslint-disable-next-line no-param-reassign -- Mongoose document must be mutated to save changes
    user.password_requires_upgrade = true;
    await user.save();
    logger.warn(
      { userId: user._id.toString(), email: user.email },
      'User logged in with weak password; flagged for upgrade'
    );
  }

  // Update last login timestamp
  // eslint-disable-next-line no-param-reassign -- Mongoose document must be mutated to save changes
  user.last_login_at = new Date();
  await user.save();

  return true;
}

/**
 * Auth.js configuration for Express backend using @auth/express
 * Integrates with MongoDB adapter and custom RBAC via callbacks
 */
// Create adapter instance for use in authorize callback
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion -- MongoDB adapter requires type casting due to version mismatch
const mongoAdapter = MongoDBAdapter(mongoose.connection.getClient() as any) as Adapter;

export const authConfig: AuthConfig = {
  adapter: mongoAdapter,
  basePath: '/auth',
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Partial<Record<'email' | 'password', unknown>>) {
        if (typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
          return null;
        }

        const { email, password } = credentials;

        try {
          const user = await User.findOne({ email: email.toLowerCase() }).select(
            '+password_hash +password_requires_upgrade'
          );

          if (user === null) {
            logger.warn({ email }, 'Login attempt with invalid email');
            return null;
          }

          const isValid = await validateUserPassword(user, password);
          if (!isValid) {
            return null;
          }

          logger.info({ email, userId: user._id.toString() }, 'User logged in successfully');

          const userId = user._id.toString();

          // Explicitly create database session for Credentials provider
          // Auth.js does not auto-create DB sessions for Credentials logins with database strategy.
          // Without this, the session callback will not receive a user and role aggregation will be skipped.
          // ExpressAuth will automatically set the session cookie after successful authentication.
          await createCredentialsSession(mongoAdapter, userId);

          return {
            id: userId,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          logger.error({ error, email }, 'Error during authentication');
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: Math.floor(config.auth.sessionMaxAge / MS_PER_SECOND), // Convert ms to seconds
  },
  callbacks: {
    async session({ session, user }) {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition -- session.user and user are objects that can be truthy/falsy
      if (session.user && user) {
        const { user: sessionUser } = session;
        const { id, email, name } = user;
        sessionUser.id = id;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- MongoDB adapter may return undefined even though model requires these fields
        sessionUser.email = email ?? null;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- MongoDB adapter may return undefined even though model requires these fields
        sessionUser.name = name ?? null;
        // Aggregate roles from all projects
        try {
          const roles = await aggregateUserRoles(id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Extending session user with roles
          (sessionUser as any).roles = roles;
        } catch (error) {
          logger.error({ error, userId: id }, 'Error aggregating user roles in session callback');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion -- Extending session user with roles
          (sessionUser as any).roles = [];
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: config.auth.sessionSecret,
  trustHost: true, // Required for proxy environments (set app.set('trust proxy', true) in Express)
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: config.server.isProduction,
        maxAge: Math.floor(config.auth.sessionMaxAge / MS_PER_SECOND), // Convert ms to seconds
      },
    },
  },
};
