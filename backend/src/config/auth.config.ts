import type { Adapter } from '@auth/core/adapters';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import type { AuthConfig } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import { mongoose } from '../db';
import { User } from '../models/user.model';
import { ProjectService } from '../services/project.service';
import { config } from './index';
import { logger } from '../utils/logger';

const MS_PER_SECOND = 1000;

/**
 * Aggregate all roles for a user across all projects
 * Returns a de-duplicated array of role strings
 * This replaces the logic from role-aggregator.ts
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
 * Auth.js configuration for Express backend using @auth/express
 * Integrates with MongoDB adapter and custom RBAC via callbacks
 */
export const authConfig: AuthConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unnecessary-type-assertion -- MongoDB adapter requires type casting due to version mismatch
  adapter: MongoDBAdapter(mongoose.connection.getClient() as any) as Adapter,
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

          const isPasswordValid = await user.comparePassword(password);
          if (!isPasswordValid) {
            logger.warn(
              { email, userId: user._id.toString() },
              'Login attempt with invalid password'
            );
            return null;
          }

          if (user.status !== 'active') {
            logger.warn({ email, userId: user._id.toString() }, 'Login attempt for disabled user');
            return null;
          }

          // Flag weak passwords for upgrade (does not block login)
          const STRONG_MIN_PASSWORD_LENGTH = 12;
          if (
            password.length < STRONG_MIN_PASSWORD_LENGTH &&
            user.password_requires_upgrade !== true
          ) {
            user.password_requires_upgrade = true;
            await user.save();
            logger.warn(
              { userId: user._id.toString(), email },
              'User logged in with weak password; flagged for upgrade'
            );
          }

          // Update last login timestamp
          user.last_login_at = new Date();
          await user.save();

          logger.info({ email, userId: user._id.toString() }, 'User logged in successfully');

          return {
            id: user._id.toString(),
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
        sessionUser.email = email;
        sessionUser.name = name;
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
