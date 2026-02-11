/**
 * Integration smoke tests for the complete HashHive API.
 *
 * These tests validate the full request/response cycle through the
 * Hono app without requiring a running database. They verify that
 * routing, middleware, and validation work end-to-end.
 *
 * Agent auth now validates pre-shared tokens against the database,
 * so tests requiring authenticated agent requests need a running DB
 * (or mocked DB in unit tests).
 *
 * For full integration tests with a real database, use the
 * docker-compose dev environment and run with --integration flag.
 */
import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index.js';
import { sessionToken } from '../fixtures.js';

describe('Integration: Health check', () => {
  it('should return health status with all expected fields', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body['status']).toBe('ok');
    expect(body['version']).toBe('1.0.0');
    expect(typeof body['timestamp']).toBe('string');

    // Validate ISO 8601 timestamp
    const date = new Date(body['timestamp']);
    expect(date.toISOString()).toBe(body['timestamp']);
  });
});

describe('Integration: Agent workflow validation', () => {
  it('should enforce auth on all agent endpoints', async () => {
    const endpoints = [
      { method: 'POST', path: '/api/v1/agent/heartbeat' },
      { method: 'POST', path: '/api/v1/agent/tasks/next' },
      { method: 'POST', path: '/api/v1/agent/tasks/1/report' },
      { method: 'POST', path: '/api/v1/agent/errors' },
    ];

    for (const { method, path } of endpoints) {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
    }
  });

  it('should return 404 for removed /sessions endpoint', async () => {
    const res = await app.request('/api/v1/agent/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'some-token' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('Integration: Dashboard workflow validation', () => {
  it('should enforce session auth on all dashboard endpoints', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/v1/dashboard/projects' },
      { method: 'GET', path: '/api/v1/dashboard/agents' },
      { method: 'GET', path: '/api/v1/dashboard/campaigns' },
      { method: 'GET', path: '/api/v1/dashboard/tasks' },
      { method: 'GET', path: '/api/v1/dashboard/resources/hash-types' },
    ];

    for (const { method, path } of endpoints) {
      const res = await app.request(path, { method });
      expect(res.status).toBe(401);
    }
  });

  it('should allow hash type detection with valid session', async () => {
    const token = await sessionToken();
    const res = await app.request('/api/v1/dashboard/hashes/guess-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `session=${token}`,
      },
      body: JSON.stringify({
        hashValue: '$2b$12$WApznUPhDubN0oeveSXHp.Ux5KijMo/Hkb3Gf/.GfCVyhPMHO2G.6',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['identified']).toBe(true);
    expect(body['candidates'][0]['name']).toBe('bcrypt');
  });

  it('should enforce login validation', async () => {
    const res = await app.request('/api/v1/dashboard/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad', password: '1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Integration: Cross-cutting concerns', () => {
  it('should return request ID in response headers', async () => {
    const res = await app.request('/health');
    const requestId = res.headers.get('x-request-id');
    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe('string');
  });

  it('should respect custom request ID header', async () => {
    const customId = 'test-request-123';
    const res = await app.request('/health', {
      headers: { 'x-request-id': customId },
    });
    expect(res.headers.get('x-request-id')).toBe(customId);
  });

  it('should return structured 404 for unknown routes', async () => {
    const res = await app.request('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body['error']['code']).toBe('NOT_FOUND');
  });

  it('should include security headers', async () => {
    const res = await app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBeDefined();
  });
});
