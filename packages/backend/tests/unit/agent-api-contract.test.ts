/**
 * Agent API contract tests.
 *
 * These validate that route handlers return response shapes matching
 * the OpenAPI spec (agent-api.yaml). They use the Hono test client
 * (app.request) and don't require a running database — they only test
 * response structure on paths that don't hit the DB (auth failures,
 * validation errors).
 *
 * Endpoints that require DB state are tested for auth and validation only.
 * The /sessions endpoint hits the DB directly, so it's tested for validation only.
 */
import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index.js';
import { agentToken } from '../fixtures.js';

const AGENT_BASE = '/api/v1/agent';

// ─── POST /sessions — Authentication ────────────────────────────────

describe('Agent API: POST /sessions', () => {
  it('should return 400 for missing token field', async () => {
    const res = await app.request(`${AGENT_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Zod validator returns 400 for validation errors
    expect(res.status).toBe(400);
  });

  it('should return 400 for empty token', async () => {
    const res = await app.request(`${AGENT_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });

    expect(res.status).toBe(400);
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
    const token = await agentToken(1);
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
    const token = await agentToken(1);
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
    const token = await agentToken(1);
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
    const token = await agentToken(1);
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
