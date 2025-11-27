import { getSession } from '@auth/express';
import { authConfig } from '../config/auth.config';
import { logger } from '../utils/logger';
import type { Request } from 'express';

/**
 * Thin wrapper over Auth.js for Express backend
 * Provides consistent interface with legacy auth.service.ts
 * Note: signIn/signOut are handled by ExpressAuth routes at /auth/signin and /auth/signout
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Service class pattern for static methods
export class AuthService {
  /**
   * Login user with email and password
   * Note: Actual login is handled by ExpressAuth at POST /auth/signin/credentials
   * This method is kept for interface compatibility but should not be used directly
   * @deprecated Use ExpressAuth routes directly
   */
  static login(_req: Request, _email: string, _password: string): void {
    logger.warn(
      'AuthService.login is deprecated. Use POST /auth/signin/credentials endpoint instead.'
    );
    throw new Error('Use POST /auth/signin/credentials endpoint for login');
  }

  /**
   * Logout user
   * Note: Actual logout is handled by ExpressAuth at POST /auth/signout
   * This method is kept for interface compatibility but should not be used directly
   * @deprecated Use ExpressAuth routes directly
   */
  static logout(_req: Request): void {
    logger.warn('AuthService.logout is deprecated. Use POST /auth/signout endpoint instead.');
    throw new Error('Use POST /auth/signout endpoint for logout');
  }

  /**
   * Get current session
   * Uses Auth.js getSession function
   */
  static async getSession(req: Request): Promise<Awaited<ReturnType<typeof getSession>>> {
    try {
      return await getSession(req, authConfig);
    } catch (error) {
      logger.error({ error }, 'Error getting session');
      return null as Awaited<ReturnType<typeof getSession>>;
    }
  }

  /**
   * Get user from session
   */
  static async getUser(
    req: Request
  ): Promise<{ id: string; email: string; name: string; roles?: string[] } | null> {
    const session = await this.getSession(req);
    if (session === null || typeof session !== 'object') {
      return null;
    }

    const sessionWithUser = session as { user?: unknown };
    const { user } = sessionWithUser;
    if (user === null || user === undefined || typeof user !== 'object') {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Auth.js session user type
    return user as { id: string; email: string; name: string; roles?: string[] };
  }
}
