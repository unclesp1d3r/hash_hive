import { Hono } from 'hono';
import { requireSession } from '../../middleware/auth.js';
import { getUserWithProjects } from '../../services/auth.js';
import type { AppEnv } from '../../types.js';

const authRouter = new Hono<AppEnv>();

/**
 * GET /me -- returns the authenticated user's profile and project memberships.
 * Login/logout are now handled by BetterAuth at /api/auth/*.
 */
authRouter.get('/me', requireSession, async (c) => {
  const { userId } = c.get('currentUser');
  const result = await getUserWithProjects(userId);

  if (!result) {
    return c.json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'User not found' } }, 404);
  }

  return c.json(result);
});

export { authRouter as authRoutes };
