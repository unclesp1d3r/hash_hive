import { agents } from '@hashhive/shared';
import { eq } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import type { AppEnv } from '../types.js';

function authError(message: string): HTTPException {
  return new HTTPException(401, {
    res: new Response(JSON.stringify({ error: { code: 'AUTH_TOKEN_INVALID', message } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    }),
  });
}

/**
 * Dashboard auth middleware — reads JWT from HttpOnly cookie "session".
 * Sets currentUser on context if valid.
 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, 'session');
  if (!token) {
    throw authError('Authentication required');
  }

  const payload = await validateToken(token);
  if (!payload || payload.type !== 'session') {
    throw authError('Invalid or expired session');
  }

  c.set('currentUser', {
    userId: payload.userId,
    email: payload.email,
    projectId: payload.projectId ?? null,
  });
  await next();
});

/**
 * Agent auth middleware — validates pre-shared token from Authorization: Bearer header.
 * Queries the agents table directly and sets agent context (agentId, projectId, capabilities).
 */
export const requireAgentToken = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw authError('Bearer token required');
  }

  const token = authHeader.slice(7);

  const [agent] = await db
    .select({
      id: agents.id,
      projectId: agents.projectId,
      status: agents.status,
      capabilities: agents.capabilities,
    })
    .from(agents)
    .where(eq(agents.authToken, token))
    .limit(1);

  if (!agent || agent.status === 'error') {
    throw authError('Invalid or expired agent token');
  }

  c.set('agent', {
    agentId: agent.id,
    projectId: agent.projectId,
    capabilities: (agent.capabilities ?? {}) as Record<string, unknown>,
  });
  await next();
});
