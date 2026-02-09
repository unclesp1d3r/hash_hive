import { projectUsers } from '@hashhive/shared';
import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import type { AppEnv } from '../types.js';

type Role = 'admin' | 'operator' | 'analyst' | 'agent_owner';

function httpError(status: 401 | 403 | 400, code: string, message: string): HTTPException {
  return new HTTPException(status, {
    res: new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  });
}

/**
 * Require that the current user has at least one of the given roles
 * within the specified project. Project ID is read from the route
 * param `:projectId` or the query string `projectId`.
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('currentUser');
    if (!user) {
      throw httpError(401, 'AUTH_TOKEN_INVALID', 'Authentication required');
    }

    const projectId = Number(c.req.param('projectId')) || Number(c.req.query('projectId')) || null;

    if (!projectId) {
      throw httpError(400, 'VALIDATION_FAILED', 'Project ID is required for this operation');
    }

    const [membership] = await db
      .select()
      .from(projectUsers)
      .where(and(eq(projectUsers.userId, user.userId), eq(projectUsers.projectId, projectId)))
      .limit(1);

    if (!membership) {
      throw httpError(403, 'AUTHZ_PROJECT_ACCESS_DENIED', 'Not a member of this project');
    }

    const hasRole = membership.roles.some((r) => roles.includes(r as Role));
    if (!hasRole) {
      throw httpError(
        403,
        'AUTHZ_INSUFFICIENT_PERMISSIONS',
        `Requires one of: ${roles.join(', ')}`
      );
    }

    await next();
  });
}

/**
 * Require that the current user is a member of the specified project
 * (any role). Lighter check than requireRole.
 */
export function requireProjectAccess() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('currentUser');
    if (!user) {
      throw httpError(401, 'AUTH_TOKEN_INVALID', 'Authentication required');
    }

    const projectId = Number(c.req.param('projectId')) || Number(c.req.query('projectId')) || null;

    if (!projectId) {
      throw httpError(400, 'VALIDATION_FAILED', 'Project ID is required for this operation');
    }

    const [membership] = await db
      .select()
      .from(projectUsers)
      .where(and(eq(projectUsers.userId, user.userId), eq(projectUsers.projectId, projectId)))
      .limit(1);

    if (!membership) {
      throw httpError(403, 'AUTHZ_PROJECT_ACCESS_DENIED', 'Not a member of this project');
    }

    await next();
  });
}
