import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index.js';

describe('GET /health', () => {
  it('should return status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body['status']).toBe('ok');
    expect(body['version']).toBe('1.0.0');
    expect(body['timestamp']).toBeDefined();
  });
});

describe('404 handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body['error']['code']).toBe('NOT_FOUND');
  });
});
