---
name: hashhive-patterns
description: Coding patterns extracted from the HashHive monorepo
version: 1.0.0
source: local-git-analysis
analyzed_commits: 32
---

# HashHive Development Patterns

## Commit Conventions

This project uses **conventional commits** with a `type: description` format:

```
feat: add campaign orchestration with DAG validation
fix: resolve HTTPException handling in error middleware
refactor: replace NX/Express with Turborepo/Hono
docs: add MERN migration specifications
test: add integration smoke tests
chore: configure Dependabot
```

Types used (by frequency): `feat`, `Add` (imperative), `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `delete`

Attribution line (when AI-assisted):

```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Code Architecture

### Monorepo Layout

```
packages/
├── backend/          # Bun + Hono API
│   ├── src/
│   │   ├── config/       # env.ts, logger.ts, redis.ts, queue.ts, storage.ts
│   │   ├── db/           # Drizzle client (index.ts)
│   │   ├── middleware/   # auth.ts, rbac.ts, request-id.ts, etc.
│   │   ├── routes/
│   │   │   ├── agent/    # Agent API (/api/v1/agent/*)
│   │   │   └── dashboard/# Dashboard API (/api/v1/dashboard/*)
│   │   ├── services/     # Business logic by domain
│   │   └── scripts/      # CLI tools (migrate-data.ts)
│   └── tests/
│       ├── unit/         # Pure logic tests
│       ├── integration/  # API smoke tests
│       ├── fixtures.ts   # Factory functions
│       └── preload.ts    # Test env setup
│
├── frontend/         # React 19 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/       # shadcn/ui base
│   │   │   └── features/ # Domain components
│   │   ├── hooks/        # TanStack Query wrappers (use-*.ts)
│   │   ├── pages/        # Route pages
│   │   ├── stores/       # Zustand stores
│   │   └── lib/          # api.ts, utils.ts
│   └── tests/
│       ├── components/   # Testing Library tests
│       ├── setup.ts      # happy-dom setup
│       └── test-utils.tsx# renderWithProviders wrapper
│
├── shared/           # Drizzle schema → Zod → types
│   └── src/
│       ├── db/schema.ts  # SOURCE OF TRUTH
│       ├── schemas/      # drizzle-zod generated
│       └── types/        # z.infer exports
│
└── openapi/          # API contracts
    └── agent-api.yaml
```

### Schema Flow (One Direction, No Duplication)

```
Drizzle tables (schema.ts)
    → drizzle-zod (createInsertSchema, createSelectSchema)
    → Zod schemas (schemas/index.ts)
    → z.infer types (types/index.ts)
```

### Route → Service → DB Pattern

```typescript
// Route handler (thin): validate input, call service, return response
routeHandler.post("/endpoint", zValidator("json", schema), async (c) => {
  const data = c.req.valid("json");
  const result = await serviceFunction(data);
  return c.json(result);
});

// Service (optional): business logic + Drizzle queries
export async function serviceFunction(data: InputType) {
  const [row] = await db.insert(table).values(data).returning();
  return row ?? null;
}
```

## TypeScript Strict Mode Patterns

The project uses **maximum strictness** in tsconfig.base.json:

| Setting                                    | Pattern It Enforces                   |
| ------------------------------------------ | ------------------------------------- |
| `exactOptionalPropertyTypes: true`         | Use spread instead of `?? undefined`  |
| `noPropertyAccessFromIndexSignature: true` | Use `obj['key']` for index signatures |
| `noUncheckedIndexedAccess: true`           | Guard array access with null checks   |
| `noNonNullAssertion: true` (biome)         | Avoid `!` operator                    |

### Key Pattern: Spread for Optional Properties

```typescript
// BAD — fails with exactOptionalPropertyTypes
const opts = { status: filterStatus || undefined };

// GOOD — spread pattern
const opts = filterStatus ? { status: filterStatus } : undefined;

// GOOD — spread into object
const body = {
  name: data.name,
  ...(data.description ? { description: data.description } : {}),
  ...(data.hashListId ? { hashListId: data.hashListId } : {}),
};
```

### Key Pattern: Array Index Safety

```typescript
// BAD — noUncheckedIndexedAccess
const item = arr[i]; // type is T | undefined

// GOOD — guard first
const item = arr[i];
if (!item) continue;
// item is now T
```

## Biome Configuration Patterns

- **`useLiteralKeys: "off"`** — MUST stay off (conflicts with `noPropertyAccessFromIndexSignature`)
- **Test file overrides**: `noExplicitAny`, `noBannedTypes`, `noNonNullAssertion` all `"off"`
- **Script overrides** (`**/scripts/**`): `noConsole: "off"`, `noExplicitAny: "off"`
- **Inline suppression**: `biome-ignore lint/rule/name: reason`

## Testing Patterns

### Backend Tests (bun:test)

```typescript
import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index.js';

describe('Feature', () => {
  it('should do something', async () => {
    const res = await app.request('/path', { method: 'POST', ... });
    expect(res.status).toBe(200);
  });
});
```

- **Unit tests**: `tests/unit/*.test.ts` — pure logic, no DB
- **Integration tests**: `tests/integration/*.test.ts` — full app.request cycle
- **Contract tests**: Validate auth guards (401) + schema validation (400) per endpoint
- **Fixtures**: Factory functions (`buildUser()`, `buildAgent()`, etc.) in `tests/fixtures.ts`
- **Token helpers**: `sessionToken()` and `agentToken()` for auth in tests

### Frontend Tests (bun:test + Testing Library)

```typescript
import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';

afterEach(cleanup);  // REQUIRED — DOM persists between tests

describe('Component', () => {
  it('should render', () => {
    renderWithProviders(<Component prop="value" />);
    expect(screen.getByText('value')).toBeDefined();
  });
});
```

## Workflow Patterns

### Adding a Backend Feature

1. Define Drizzle table in `shared/src/db/schema.ts` (if new table)
2. Run `bun --filter shared build` to rebuild
3. Add Zod schemas in `shared/src/schemas/index.ts`
4. Add types in `shared/src/types/index.ts`
5. Create service in `backend/src/services/{domain}.ts`
6. Create route in `backend/src/routes/dashboard/{domain}.ts`
7. Mount route in `backend/src/index.ts`
8. Add contract tests in `backend/tests/unit/{domain}-contract.test.ts`
9. Run `bun run build && bun run lint && bun run type-check && bun run test`

### Adding a Frontend Page

1. Create hooks in `frontend/src/hooks/use-{domain}.ts`
2. Create page in `frontend/src/pages/{page}.tsx`
3. Add route in `frontend/src/main.tsx`
4. Add component tests in `frontend/tests/components/{component}.test.tsx`
5. Run full check suite

### Validation Checklist (Run After Every Change)

```bash
bun run build && bun run lint && bun run type-check && bun run test
```

## Co-Change Patterns

Files that **always change together**:

- `shared/src/db/schema.ts` ↔ `shared/src/schemas/index.ts` ↔ `shared/src/types/index.ts`
- `backend/src/index.ts` ↔ `backend/src/routes/dashboard/{new-route}.ts` (route mounting)
- `frontend/src/main.tsx` ↔ `frontend/src/pages/{new-page}.tsx` (route registration)
- `.kiro/specs/mern-migration/tasks.md` changes with every task completion

## Common Gotchas

1. **Don't run `bun add` while tests are running** — corrupts node_modules
2. **Shared package must build before backend/frontend** — Turborepo handles via `dependsOn`
3. **HTTPException in onError** — must check `instanceof HTTPException` before returning 500
4. **happy-dom cleanup** — call `cleanup()` in `afterEach` or DOM persists between tests
5. **Biome `--unsafe` fixes** — always run `type-check` after `biome check --write --unsafe`
6. **React Hook Form + zodResolver** — pre-bind handlers with `form.handleSubmit()` to avoid type mismatch
