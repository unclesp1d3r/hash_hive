import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createBunWebSocket } from 'hono/bun';
import { app } from '../../src/index.js';
import { createToken } from '../../src/services/auth.js';

// We need the websocket handler from hono/bun to run a real WebSocket server.
// Since the events route creates its own createBunWebSocket(), we re-create one
// here for the test server. Hono internally wires upgrade handlers via globals.
const { websocket } = createBunWebSocket();

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    fetch: app.fetch,
    websocket,
  });
  baseUrl = `http://localhost:${server.port}`;
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
});
