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
 * Validates user password and updates user record if needed.
 *
 * @param user - User document from database
 * @param password - Plain text password to validate
 * @returns true if password is valid, false otherwise
 */
async function validateUserPassword(
  user: InstanceType<typeof User>,
  password: string
): Promise<boolean> {
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    logger.warn(
      { email: user.email, userId: user._id.toString() },
      'Login attempt with invalid password'
    );
    return false;
  }

  if (user.status !== 'active') {
    logger.warn(
      { email: user.email, userId: user._id.toString() },
      'Login attempt for disabled user'
    );
    return false;
  }

  // Flag weak passwords for upgrade (does not block login)
  const STRONG_MIN_PASSWORD_LENGTH = 12;
  if (password.length < STRONG_MIN_PASSWORD_LENGTH && user.password_requires_upgrade !== true) {
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

          // Auth.js with MongoDB adapter automatically creates a session when authorize returns a user
          // The session callback will receive the user from the adapter for role aggregation
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
    strategy: 'jwt',
    maxAge: Math.floor(config.auth.sessionMaxAge / MS_PER_SECOND), // Convert ms to seconds
  },
  callbacks: {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-member-access, no-param-reassign, @typescript-eslint/no-unnecessary-condition -- Auth.js JWT strategy requires extending token and session objects with custom properties, which necessitates the use of `any` types and parameter reassignment */
    async jwt({ token, user }): Promise<any> {
      // When user first signs in, user object is provided; on subsequent calls it may be undefined
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- user can be undefined on token refresh
      if (user) {
        const { id, email, name } = user;
        (token as any)['id'] = id;
        (token as any)['email'] = email ?? null;
        (token as any)['name'] = name ?? null;
        // Aggregate roles from all projects
        try {
          const roles = await aggregateUserRoles(id);
          (token as any)['roles'] = roles;
        } catch (error) {
          logger.error({ error, userId: id }, 'Error aggregating user roles in jwt callback');
          (token as any)['roles'] = [];
        }
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- Session callback must be async for Auth.js compatibility
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- session.user and token are objects that can be truthy/falsy
      if (session.user && token) {
        const { user: sessionUser } = session;
        const tokenId = (token as any).id as string | undefined;
        const tokenEmail = (token as any).email as string | null | undefined;
        const tokenName = (token as any).name as string | null | undefined;
        const tokenRoles = (token as any).roles as string[] | undefined;
        if (tokenId !== undefined) {
          sessionUser.id = tokenId;
        }
        (sessionUser as any).email = tokenEmail ?? null;
        (sessionUser as any).name = tokenName ?? null;
        (sessionUser as any).roles = tokenRoles ?? [];
      }
      return session;
    },
    /* eslint-enable */
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
