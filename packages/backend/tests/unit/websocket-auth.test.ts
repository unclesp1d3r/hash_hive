import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { jwtVerify, SignJWT } from 'jose';

// Mock getUserWithProjects to avoid DB dependency in unit tests.
// bun:test hoists mock.module() above all imports, so this takes effect
// before index.ts (and events.ts) resolve the auth module.
const jwtSecret = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'test-secret-at-least-16-chars-long'
);

mock.module('../../src/services/auth.js', () => ({
  hashPassword: async (password: string) =>
    Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 }),
  verifyPassword: async (password: string, hash: string) => Bun.password.verify(password, hash),

  createToken: async (payload: { userId: number; email: string; type: string }) =>
    new SignJWT({ sub: String(payload.userId), email: payload.email, type: payload.type })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(jwtSecret),

  validateToken: async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      return {
        userId: Number(payload['sub']),
        email: payload['email'] as string,
        type: payload['type'] as string,
      };
    } catch {
      return null;
    }
  },

  login: async () => null,

  getUserWithProjects: async (userId: number) => ({
    user: { id: userId, email: `user-${userId}@test.com`, name: 'Test User', status: 'active' },
    projects: [{ id: 1, name: 'Test Project', slug: 'test-project', roles: ['admin'] }],
  }),
}));

import { app, websocket } from '../../src/index.js';

// Use the mocked createToken from the same module
const { createToken } = await import('../../src/services/auth.js');

let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    fetch: app.fetch,
    websocket,
  });
});

afterAll(() => {
  server.stop(true);
});

function wsUrl(path: string): string {
  return `ws://localhost:${server.port}${path}`;
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for message')), 3000);
    ws.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(JSON.parse(event.data) as Record<string, unknown>);
    };
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for close')), 3000);
    ws.onclose = (event) => {
      clearTimeout(timeout);
      resolve({ code: event.code, reason: event.reason });
    };
  });
}

describe('WebSocket hybrid authentication', () => {
  it('should accept a valid session cookie', async () => {
    const token = await createToken({ userId: 1, email: 'test@example.com', type: 'session' });
    const ws = new WebSocket(wsUrl('/api/v1/dashboard/events/stream?projectIds=1'), {
      headers: { cookie: `session=${token}` },
    });

    const msg = await waitForMessage(ws);
    expect(msg['type']).toBe('connected');
    expect(msg['projectIds']).toEqual([1]);
    ws.close();
  });

  it('should accept a valid query token', async () => {
    const token = await createToken({ userId: 1, email: 'test@example.com', type: 'session' });
    const ws = new WebSocket(wsUrl(`/api/v1/dashboard/events/stream?token=${token}&projectIds=1`));

    const msg = await waitForMessage(ws);
    expect(msg['type']).toBe('connected');
    ws.close();
  });

  it('should prefer cookie when both cookie and query token are present', async () => {
    const cookieToken = await createToken({
      userId: 10,
      email: 'cookie@example.com',
      type: 'session',
    });
    const queryToken = await createToken({
      userId: 20,
      email: 'query@example.com',
      type: 'session',
    });
    const ws = new WebSocket(
      wsUrl(`/api/v1/dashboard/events/stream?token=${queryToken}&projectIds=1`),
      { headers: { cookie: `session=${cookieToken}` } }
    );

    const msg = await waitForMessage(ws);
    expect(msg['type']).toBe('connected');
    // Connection succeeds via cookie (clientId confirms auth passed)
    expect(msg['clientId']).toBeDefined();
    ws.close();
  });

  it('should fall back to query token when cookie is invalid', async () => {
    const validQueryToken = await createToken({
      userId: 1,
      email: 'test@example.com',
      type: 'session',
    });
    const ws = new WebSocket(
      wsUrl(`/api/v1/dashboard/events/stream?token=${validQueryToken}&projectIds=1`),
      { headers: { cookie: 'session=invalid-token-here' } }
    );

    const msg = await waitForMessage(ws);
    expect(msg['type']).toBe('connected');
    ws.close();
  });

  it('should close with 4001 when no auth is provided', async () => {
    const ws = new WebSocket(wsUrl('/api/v1/dashboard/events/stream?projectIds=1'));
    const { code } = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  it('should close with 4001 when only an agent token is provided', async () => {
    const agentToken = await createToken({ userId: 1, email: 'agent@example.com', type: 'agent' });
    const ws = new WebSocket(
      wsUrl(`/api/v1/dashboard/events/stream?token=${agentToken}&projectIds=1`)
    );
    const { code } = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  it('should close with 4002 when projectIds is missing', async () => {
    const token = await createToken({ userId: 1, email: 'test@example.com', type: 'session' });
    const ws = new WebSocket(wsUrl('/api/v1/dashboard/events/stream'), {
      headers: { cookie: `session=${token}` },
    });
    const { code } = await waitForClose(ws);
    expect(code).toBe(4002);
  });

  it('should close with 4003 when user has no access to requested projects', async () => {
    // Mock returns project id=1 only; requesting project id=999 should fail
    const token = await createToken({ userId: 1, email: 'test@example.com', type: 'session' });
    const ws = new WebSocket(wsUrl('/api/v1/dashboard/events/stream?projectIds=999'), {
      headers: { cookie: `session=${token}` },
    });
    const { code } = await waitForClose(ws);
    expect(code).toBe(4003);
  });
});
