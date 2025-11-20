# HashHive AI Coding Instructions

HashHive is a greenfield MERN (MongoDB, Express, React, Node.js) platform orchestrating distributed password cracking with hashcat. This is a test/development project based on CipherSwarm architecture.

## Architecture Overview

**Three-tier monorepo:**

- `backend/` - Node.js + Express/Fastify API with Mongoose ODM
- `frontend/` - Next.js with App Router, shadcn/ui, React Query
- `shared/` - Common TypeScript types and Zod schemas

**Service layer pattern:** Business logic lives in `backend/src/services/`, NOT in route handlers. Routes are thin controllers that validate input, call services, and map responses.

**Key services** (see `.kiro/specs/mern-migration/design.md`):

- `AuthService` - JWT/session auth, password hashing
- `ProjectService` - Multi-tenancy, role-based access control
- `AgentService` - Agent registration, heartbeat, capability detection
- `CampaignService` - Campaign lifecycle, attack DAG validation
- `TaskDistributionService` - Keyspace partitioning, queue-based task assignment
- `ResourceService` - S3-compatible storage for hash lists/wordlists/etc
- `HashAnalysisService` - Hash type identification, hashcat mode mapping
- `EventService` - Real-time WebSocket/SSE broadcasts

## Critical Design Documents

**Always consult before major changes:**

- `.kiro/steering/` - Product overview, tech stack, structure (source of truth)
- `.kiro/specs/mern-migration/` - Requirements, detailed design, task breakdown
- `AGENTS.md` - AI agent guidance (this file provides extended context)
- `openapi/agent-api.yaml` - Agent API contract (single source of truth for agent endpoints)

## Development Workflow

```bash
# Quick start
npm install                    # Install all workspace deps
docker compose up -d          # Start MongoDB, Redis, MinIO
npm run dev                   # Start both backend + frontend

# Or use just commands
just setup                    # Complete first-time setup
just dev                      # Start all services
just test                     # Run all tests
just lint                     # Lint all code

# Individual packages
npm run dev -w backend        # Backend only (port 3001)
npm run dev -w frontend       # Frontend only (port 3000)
npm run test -w backend       # Backend tests
npm run test:integration -w backend  # Integration tests with Testcontainers
```

## Configuration & Environment

- **Centralized config:** `backend/src/config/index.ts` with Zod validation
- **Environment files:** `backend/.env` and `frontend/.env` (copy from `.env.example`)
- **12-factor principles:** All config via env vars, fails fast on validation errors
- **Strict TypeScript:** Enabled across all packages via `tsconfig.base.json`

## Code Patterns

### Formatting & Linting

- Prettier formats all code: TypeScript, JavaScript, JSON, Markdown, **and YAML**
- Run `just format` or `npm run format` to format all files
- Husky pre-commit hooks auto-format staged files (including YAML)
- Kiro automation runs formatting on file save for all supported types

### Error Handling

- Use `AppError` class from `backend/src/middleware/error-handler.ts`
- Machine-readable error codes, structured responses with request IDs
- Log errors with Pino logger, never `console.log`

### Validation

- Zod schemas for request/response validation
- Define schemas alongside routes or in `shared/` for reuse
- Mongoose schemas use Zod for type inference where applicable

### Testing Strategy

- **Backend:** Jest + supertest for HTTP tests, Testcontainers for integration
- **Frontend:** Jest + React Testing Library for components, Playwright for E2E
- **Coverage thresholds:** 80% functions/lines/statements, 50% branches
- **Test setup:** `backend/tests/setup.ts` configures test env vars (30s timeout)

### Logging

- Use Pino logger from `backend/src/utils/logger.ts`
- Structured JSON logs with pretty-print in development
- Include context: request IDs, user IDs, operation names

### API Design

- **Agent API:** OpenAPI spec in `openapi/agent-api.yaml` - validate responses in contract tests
- **Web API:** Session-authenticated, RESTful JSON at `/api/v1/web/*`
- **Control API:** Idempotent automation endpoints at `/api/v1/control/*`
- **Versioning:** Semantic versioning with `x-agent-api-version` header for Agent API

## MongoDB & Data Access

- **Collections:** snake_case (e.g., `hash_lists`, `project_users`)
- **Mongoose models:** In `backend/src/models/` with TypeScript interfaces
- **No destructive updates:** Use explicit status fields, preserve audit trails
- **Indexes:** Add for common query patterns (see `.kiro/steering/structure.md`)

## Infrastructure Dependencies

```yaml
# docker-compose.yml provides:
MongoDB: localhost:27017       # Primary datastore
Redis: localhost:6379          # BullMQ queues + caching
MinIO: localhost:9000/9001     # S3-compatible storage (minioadmin/minioadmin)
```

## Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- MongoDB collections: `snake_case`

## Common Pitfalls

- **Don't put business logic in routes** - use service layer
- **Don't use console.log** - use Pino logger
- **Don't skip Zod validation** - validate all external input
- **Don't commit secrets** - use .env files (gitignored)
- **Agent API changes require OpenAPI spec updates** - keep contract in sync
- **Read `.kiro/specs/mern-migration/design.md` before implementing services** - detailed architecture and interactions documented there

## Real-Time Updates

- EventService broadcasts project-scoped events via WebSocket/SSE
- Frontend integrates with React Query for cache invalidation
- Agent status, campaign progress, and crack results update live

## Task Distribution Algorithm

- BullMQ-based queue system with capability-tagged queues
- Keyspace partitioning for parallel agent work
- Dead-letter queues for retry and manual intervention
- See `.kiro/specs/mern-migration/design.md` for detailed flow

## Type Safety

- Shared types in `shared/src/types/` for backend/frontend consistency
- Mongoose schemas export TypeScript interfaces
- OpenAPI spec generates types for Agent API (planned)
- Zod schemas provide runtime validation + static types
