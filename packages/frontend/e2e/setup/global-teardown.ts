import type { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig): Promise<void> {
  const state = globalThis.__e2eState;
  if (!state) {
    console.log('[E2E] No global state found, skipping teardown');
    return;
  }

  console.log('[E2E] Tearing down test infrastructure...');

  // 1. Stop backend server
  try {
    state.backendProcess.kill();
    await state.backendProcess.exited;
    console.log('[E2E] Backend server stopped');
  } catch {
    console.log('[E2E] Backend server already stopped');
  }

  // 2. Stop infrastructure based on mode
  if (state.mode === 'docker-compose') {
    console.log('[E2E] Stopping docker compose stack...');
    const downProc = Bun.spawn(['docker', 'compose', '-f', state.composeFile, 'down', '-v'], {
      stdout: 'inherit',
      stderr: 'inherit',
    });
    await downProc.exited;
    console.log('[E2E] Docker compose stack stopped');
  } else {
    // Stop testcontainers in parallel
    await Promise.all([
      state.pgContainer.stop().then(() => console.log('[E2E] PostgreSQL container stopped')),
      state.redisContainer.stop().then(() => console.log('[E2E] Redis container stopped')),
      state.minioContainer.stop().then(() => console.log('[E2E] MinIO container stopped')),
    ]);
  }

  globalThis.__e2eState = undefined;
  console.log('[E2E] Teardown complete');
}

export default globalTeardown;
