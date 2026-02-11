/**
 * Agent API contract tests.
 *
 * These validate that route handlers return response shapes matching
 * the OpenAPI spec (agent-api.yaml). They use the Hono test client
 * (app.request) and mock the database layer to avoid needing a running
 * database.
 *
 * The middleware validates pre-shared tokens by querying the agents table.
 * We mock the DB to return a valid agent for our test token.
 */
import { describe, expect, it, mock } from 'bun:test';

// Mock the DB so requireAgentToken middleware can resolve the pre-shared token
const TEST_AGENT_TOKEN = 'test-agent-preshared-token';
const mockSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      limit: mock(() =>
        Promise.resolve([
          {
            id: 1,
            projectId: 1,
            status: 'active',
            capabilities: {},
          },
        ])
      ),
    })),
  })),
}));

mock.module('../../src/db/index.js', () => ({
  db: {
    select: mockSelect,
  },
  client: {},
}));

import { app } from '../../src/index.js';
import { agentToken } from '../fixtures.js';

const AGENT_BASE = '/api/v1/agent';

// ─── POST /sessions — removed (should 404) ──────────────────────────

describe('Agent API: POST /sessions (removed)', () => {
  it('should return 404 since session endpoint no longer exists', async () => {
    const res = await app.request(`${AGENT_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'some-token' }),
    });

    expect(res.status).toBe(404);
  });
});

// ─── POST /heartbeat — Agent Heartbeat ──────────────────────────────

describe('Agent API: POST /heartbeat', () => {
  it('should return 401 without auth token', async () => {
    const res = await app.request(`${AGENT_BASE}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'online' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body['error']).toBeDefined();
    expect(body['error']['code']).toBe('AUTH_TOKEN_INVALID');
  });

  it('should return 400 for invalid heartbeat status enum', async () => {
    const token = agentToken(TEST_AGENT_TOKEN);
    const res = await app.request(`${AGENT_BASE}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'invalid-status' }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── POST /tasks/next — Request Next Task ───────────────────────────

describe('Agent API: POST /tasks/next', () => {
  it('should return 401 without auth token', async () => {
    const res = await app.request(`${AGENT_BASE}/tasks/next`, {
      method: 'POST',
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body['error']).toBeDefined();
  });
});

// ─── POST /tasks/:id/report — Report Task Progress ─────────────────

describe('Agent API: POST /tasks/:id/report', () => {
  it('should return 401 without auth token', async () => {
    const res = await app.request(`${AGENT_BASE}/tasks/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'running' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid status enum', async () => {
    const token = agentToken(TEST_AGENT_TOKEN);
    const res = await app.request(`${AGENT_BASE}/tasks/1/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'not-a-valid-status' }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── POST /errors — Report Agent Error ──────────────────────────────

describe('Agent API: POST /errors', () => {
  it('should return 401 without auth token', async () => {
    const res = await app.request(`${AGENT_BASE}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'error', message: 'test error' }),
    });

    expect(res.status).toBe(401);
  });

  it('should return 400 for missing required fields', async () => {
    const token = agentToken(TEST_AGENT_TOKEN);
    const res = await app.request(`${AGENT_BASE}/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid severity enum', async () => {
    const token = agentToken(TEST_AGENT_TOKEN);
    const res = await app.request(`${AGENT_BASE}/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ severity: 'invalid', message: 'test' }),
    });

    expect(res.status).toBe(400);
  });
});
