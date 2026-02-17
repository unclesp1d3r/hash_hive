import type { FullConfig } from '@playwright/test';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { seedTestData } from './seed-data';

interface E2EGlobalState {
  pgContainer: StartedPostgreSqlContainer;
  redisContainer: StartedTestContainer;
  minioContainer: StartedTestContainer;
  backendProcess: ReturnType<typeof Bun.spawn>;
}

// Store references for teardown
declare global {
  // biome-ignore lint/style/noVar: required for Playwright global state
  var __e2eState: E2EGlobalState | undefined;
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(500);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('[E2E] Starting test infrastructure...');

  // 1. Start containers in parallel
  const [pgContainer, redisContainer, minioContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('hashhive_test')
      .withUsername('hashhive')
      .withPassword('hashhive')
      .start(),

    new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),

    new GenericContainer('minio/minio')
      .withExposedPorts(9000)
      .withCommand(['server', '/data'])
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin',
      })
      .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
      .start(),
  ]);

  console.log('[E2E] Containers started');

  const databaseUrl = pgContainer.getConnectionUri();
  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  const minioHost = minioContainer.getHost();
  const minioPort = minioContainer.getMappedPort(9000);
  const s3Endpoint = `http://${minioHost}:${minioPort}`;

  // 2. Run Drizzle migrations via drizzle-kit
  console.log('[E2E] Running database migrations...');
  const migrateProc = Bun.spawn(['bun', 'run', 'db:migrate'], {
    cwd: `${import.meta.dir}/../../../backend`,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      S3_ENDPOINT: s3Endpoint,
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'hashhive',
      JWT_SECRET: 'e2e-test-secret-key-minimum-16-chars',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const migrateExit = await migrateProc.exited;
  if (migrateExit !== 0) {
    const stderr = await new Response(migrateProc.stderr).text();
    throw new Error(`Migration failed (exit ${migrateExit}): ${stderr}`);
  }
  console.log('[E2E] Migrations complete');

  // 3. Seed test data
  console.log('[E2E] Seeding test data...');
  const { userId, projectId } = await seedTestData(databaseUrl);
  console.log(`[E2E] Seeded user=${userId}, project=${projectId}`);

  // 4. Start backend server
  console.log('[E2E] Starting backend server...');
  const backendProcess = Bun.spawn(['bun', 'run', 'src/index.ts'], {
    cwd: `${import.meta.dir}/../../../backend`,
    env: {
      ...process.env,
      PORT: '4000',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      LOG_PRETTY: 'false',
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      S3_ENDPOINT: s3Endpoint,
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'hashhive',
      JWT_SECRET: 'e2e-test-secret-key-minimum-16-chars',
      JWT_EXPIRY: '24h',
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await waitForServer('http://localhost:4000/health');
  console.log('[E2E] Backend server ready');

  // 5. Store state for teardown
  globalThis.__e2eState = {
    pgContainer,
    redisContainer,
    minioContainer,
    backendProcess,
  };

  // 6. Set env vars for Playwright tests (used by webServer proxy)
  process.env['E2E_BACKEND_URL'] = 'http://localhost:4000';
}

export default globalSetup;
