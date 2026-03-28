# Testing

All tests use **bun:test** (Bun's built-in test runner -- not Jest, not Vitest).

## Running Tests

```bash
just test                # All tests via Turborepo
just test-backend        # Backend tests only
just test-frontend       # Frontend tests only
just test-e2e            # Playwright E2E tests
just ci-check            # Full CI pipeline (lint + format + type-check + build + test)
```

## Test Types

### Backend Unit Tests

Service logic, utilities, validation schemas. Located in `packages/backend/tests/unit/`.

- Mock external dependencies (DB, queues, auth) via `bun:test` `mock.module()`
- Test fixtures in `packages/backend/tests/fixtures.ts` -- factory functions for all entity types
- **Pure function extraction**: For DB-dependent logic, extract the core algorithm as a pure function and test directly (e.g., DAG validation, threshold decisions) -- avoids complex DB mocking

### Backend Integration Tests

API endpoint validation. Located in `packages/backend/tests/integration/`.

- Test auth guards (401), validation (400), and response shapes (200) without a running DB
- Use `app.request()` (Hono's built-in test helper)
- Contract tests validate against OpenAPI spec

### Frontend Component Tests

React component testing with Testing Library. Located in `packages/frontend/tests/`.

- `happy-dom` for DOM simulation (not jsdom)
- `fireEvent` from `@testing-library/react` (`@testing-library/user-event` is not installed)
- Always call `afterEach(cleanup)` -- DOM persists in happy-dom

Test utilities in `packages/frontend/tests/`:

| File | Purpose |
|------|---------|
| `test-utils.tsx` | `renderWithProviders()`, `renderWithRouter()`, `cleanupAll()` |
| `mocks/fetch.ts` | `mockFetch()` -- route-to-response mapping for global fetch |
| `mocks/websocket.ts` | `installMockWebSocket()` with `simulateOpen/Close/Message` |
| `fixtures/api-responses.ts` | Factory functions: `mockLoginResponse`, `mockMeResponse`, etc. |
| `utils/store-reset.ts` | `resetAllStores()` for Zustand cleanup |

### E2E Tests

Playwright for complete user workflows. Located in `packages/frontend/e2e/`.

## Strategy

Test the hot paths first:

1. Hash submission ingestion
2. Work unit distribution
3. Agent heartbeat processing
4. Campaign lifecycle transitions
5. Authentication flows

Aim for 80%+ coverage. Agent API contract tests should validate responses against the OpenAPI spec to keep server and clients in sync.

## What to Know

### bun:test Mock Patterns

- `mock.module()` must come before `import` of the module under test -- bun hoists it
- `mock.module` merges mock exports into the real module's ESM namespace. Non-mocked exports pass through. Mocked ones replace the real function for ALL test files in the same run.
- Use `mockReset()` not `mockClear()` in `beforeEach` -- `mockClear()` only resets call history, queued `mockResolvedValueOnce` values leak across tests
- If tests pass in isolation but fail in the full suite, it is likely a module cache conflict. Separate conflicting mocks into different test files.

### Frontend Test Gotchas

- `api.ts` globally intercepts all 401 responses as "Session expired" -- login tests must use 400 for invalid credentials
- `PermissionGuard` hides elements -- tests asserting on guarded elements must seed the auth store with appropriate roles via `useAuthStore.setState()`
- Run tests per-package (`bun --filter @hashhive/frontend test`), not from root -- root `bun test` skips per-package `bunfig.toml` (happy-dom), causing `document is not defined`

### BetterAuth Test Mocking

Auth tests mock the BetterAuth module rather than the old JWT service:

```typescript
mock.module('../../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: async () => mockSession,
    },
    handler: async () => new Response('ok'),
  },
}));
```

Set `mockSession` to a user object for authenticated tests, or `null` for unauthenticated.
