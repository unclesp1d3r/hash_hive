/**
 * Dashboard API contract tests.
 *
 * Validates auth guards and request validation on dashboard endpoints.
 * Tests middleware layer behavior without requiring a running database.
 */
import { describe, expect, it, mock } from 'bun:test';
import { jwtVerify, SignJWT } from 'jose';

// Mock auth service so login() returns null without hitting the database.
// bun:test hoists mock.module() above all imports, so this takes effect
// before index.ts resolves the auth module.
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
  getUserWithProjects: async () => null,
  selectProject: async () => null,
}));

import { app } from '../../src/index.js';
import { agentToken, sessionToken } from '../fixtures.js';

const DASH_BASE = '/api/v1/dashboard';

// ─── Auth Guards ────────────────────────────────────────────────────

describe('Dashboard API: Auth guards', () => {
  const protectedRoutes = [
    { method: 'GET', path: '/projects' },
    { method: 'GET', path: '/agents' },
    { method: 'GET', path: '/campaigns' },
    { method: 'GET', path: '/resources/hash-types' },
    { method: 'GET', path: '/tasks' },
  ];

  for (const { method, path } of protectedRoutes) {
    it(`should return 401 for ${method} ${path} without session`, async () => {
      const res = await app.request(`${DASH_BASE}${path}`, { method });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body['error']).toBeDefined();
      expect(body['error']['code']).toBe('AUTH_TOKEN_INVALID');
    });
  }

  it('should reject agent tokens on dashboard endpoints', async () => {
    const token = agentToken();
    const res = await app.request(`${DASH_BASE}/projects`, {
      headers: { cookie: `session=${token}` },
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/login — Login ───────────────────────────────────────

describe('Dashboard API: POST /auth/login', () => {
  it('should return 400 for missing fields', async () => {
    const res = await app.request(`${DASH_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await app.request(`${DASH_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-email', password: 'longenough1' }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for short password', async () => {
    const res = await app.request(`${DASH_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid credentials', async () => {
    const res = await app.request(`${DASH_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrongpassword1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body['error']['code']).toBe('VALIDATION_INVALID_CREDENTIALS');
    expect(body['error']['message']).toBe('Invalid email or password');
  });
});

// ─── POST /campaigns — Create Campaign ──────────────────────────────

describe('Dashboard API: POST /campaigns', () => {
  it('should return 401 without session', async () => {
    const res = await app.request(`${DASH_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test', projectId: 1, hashListId: 1, priority: 5 }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /hashes/guess-type — Hash Type Detection ──────────────────

describe('Dashboard API: POST /hashes/guess-type', () => {
  it('should return hash type candidates for MD5', async () => {
    const token = await sessionToken();
    const res = await app.request(`${DASH_BASE}/hashes/guess-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `session=${token}`,
      },
      body: JSON.stringify({ hashValue: '5d41402abc4b2a76b9719d911017c592' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body['candidates']).toBeDefined();
    expect(Array.isArray(body['candidates'])).toBe(true);
    expect(body['candidates'].length).toBeGreaterThan(0);

    // Validate candidate shape
    const candidate = body['candidates'][0];
    expect(typeof candidate['name']).toBe('string');
    expect(typeof candidate['hashcatMode']).toBe('number');
    expect(typeof candidate['confidence']).toBe('number');
  });

  it('should return 400 for missing hashValue', async () => {
    const token = await sessionToken();
    const res = await app.request(`${DASH_BASE}/hashes/guess-type`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `session=${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
