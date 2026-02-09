import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
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

  c.set('currentUser', { userId: payload.userId, email: payload.email });
  await next();
});

/**
 * Agent auth middleware — reads JWT from Authorization: Bearer header.
 * Sets currentUser on context if valid.
 */
export const requireAgentToken = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw authError('Bearer token required');
  }

  const token = authHeader.slice(7);
  const payload = await validateToken(token);
  if (!payload || payload.type !== 'agent') {
    throw authError('Invalid or expired agent token');
  }

  c.set('currentUser', { userId: payload.userId, email: payload.email });
  await next();
});
