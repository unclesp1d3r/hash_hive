# E2E Tests

End-to-end tests using Playwright with Testcontainers for real infrastructure.

## Prerequisites

- **Docker** must be running (testcontainers manages container lifecycle)
- **Playwright browsers** installed: `bunx playwright install chromium`

## Running

```bash
# From frontend package
bun run test:e2e

# From monorepo root
bun run test:e2e
# or
just test-e2e
```

## Architecture

The E2E suite uses Playwright's `globalSetup` / `globalTeardown` hooks to manage infrastructure:

1. **Global Setup** (`e2e/setup/global-setup.ts`)
   - Starts PostgreSQL, Redis, and MinIO containers via testcontainers
   - Runs Drizzle migrations against the test database
   - Seeds test data (user + project + membership)
   - Starts the backend Hono server on port 4000
   - Vite dev server starts via Playwright's `webServer` config on port 3000

2. **Tests** (`e2e/smoke.spec.ts`)
   - Login with seeded credentials
   - Navigate through all core pages
   - Verify unauthenticated access redirects

3. **Global Teardown** (`e2e/setup/global-teardown.ts`)
   - Stops backend server
   - Stops all testcontainers

## Test Data

| Entity  | Value                    |
|---------|--------------------------|
| Email   | `test@hashhive.local`    |
| Password| `TestPassword123!`       |
| Project | `Test Project`           |
| Roles   | `["admin"]`              |

## Troubleshooting

- **Docker not running**: Testcontainers requires a running Docker daemon
- **Port 4000 in use**: Stop any running backend dev server before running E2E tests
- **Port 3000 in use**: Stop any running frontend dev server, or set `reuseExistingServer: true`
- **Container startup slow**: First run pulls Docker images; subsequent runs use cached images
- **Migrations fail**: Ensure `@hashhive/shared` is built (`bun run build` from root)
