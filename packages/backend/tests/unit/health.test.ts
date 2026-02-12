import { describe, expect, it, mock } from 'bun:test';

// Mock checkMinioHealth so the health test does not require a running MinIO endpoint
mock.module('../../src/config/storage.js', () => ({
  checkMinioHealth: mock(() =>
    Promise.resolve({ status: 'connected' as const, bucket: 'hashhive-test' })
  ),
  s3: {},
  uploadFile: mock(),
  downloadFile: mock(),
  deleteFile: mock(),
  getPresignedUrl: mock(),
}));

import { app } from '../../src/index.js';

describe('GET /health', () => {
  it('should return health status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body['status']);
    expect(body['version']).toBe('1.0.0');
    expect(body['timestamp']).toBeDefined();
    expect(body['services']['database']).toBeDefined();
    expect(['connected', 'disconnected']).toContain(body['services']['database']['status']);
  });

  it('should include MinIO health status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    const minio = body['services']['minio'];
    expect(minio).toBeDefined();
    expect(minio['status']).toBe('connected');
    expect(typeof minio['bucket']).toBe('string');
    expect(minio['bucket'].length).toBeGreaterThan(0);
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
