# Technology Stack

## MERN Stack Architecture

HashHive is a greenfield MERN application with TypeScript throughout, based on the CipherSwarm architecture design.

### Backend

- **Runtime**: Bun (primary runtime and package manager)
- **Framework**: Express with modular routers per domain
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod for request/response schemas and DTOs
- **Authentication**: JWT-based stateless auth for APIs, HttpOnly session cookies for web
- **Queue System**: BullMQ + Redis for background jobs and task distribution
- **Object Storage**: S3-compatible (MinIO in development) via Node SDK
- **Testing**: Jest + supertest for HTTP tests, Testcontainers for integration tests
- **Logging**: Pino with OpenTelemetry-compatible exporters

### Frontend

- **Framework**: Next.js (React, TypeScript) with App Router
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (React)
- **Forms**: React Hook Form + Zod
- **Data Fetching**: React Query (TanStack Query)
- **State Management**: React Query + local component state (minimal global state)
- **Real-time**: WebSockets/SSE for live updates
- **Testing**: Jest + React Testing Library for components, Playwright for E2E

### Infrastructure

- **Containerization**: Docker with compose/Kubernetes manifests
- **Caching**: Redis for sessions, queue state, and transient data
- **Configuration**: dotenv + centralized config module (12-factor)

### Tooling

- **Package Manager**: Bun (replaces npm)
- **Task Runner**: justfile (primary), NX (build caching and task orchestration)
- **Build Caching**: NX lightweight/inferred mode — infers targets from package.json scripts, no project.json files
- **Monorepo**: Bun workspaces (backend, frontend, shared)

## Common Commands

### Development

```bash
# Using justfile (recommended)
just dev                 # Start both backend and frontend
just dev-backend         # Start backend only
just dev-frontend        # Start frontend only
just setup               # Full project setup
just validate            # Validate project setup

# Direct commands
bun run dev              # Start both dev servers via concurrently
bun run --filter '@hashhive/backend' dev    # Start backend
bun run --filter '@hashhive/frontend' dev   # Start frontend

# Docker
docker compose up        # Start all services (mongo, redis, minio)
```

### Testing

```bash
just test                # Run all tests (NX cached)
just test-backend        # Run backend tests
just test-frontend       # Run frontend tests
just test-integration    # Run integration tests (Testcontainers)
just test-e2e            # Run E2E tests (Playwright)
just coverage            # Generate coverage report
```

### Building & Linting

```bash
just build               # Build all packages (NX cached, dependency-ordered)
just lint                # Lint all code (NX cached)
just type-check          # TypeScript type checking (NX cached)
just format              # Format all code with Prettier
just format-check        # Check formatting

# NX directly
bunx nx run-many --target=build      # Build all
bunx nx run-many --target=lint       # Lint all
bunx nx run-many --target=type-check # Type-check all
bunx nx graph                        # View dependency graph
```

### CI

```bash
just ci-check            # Full CI pipeline: lint, format-check, build, type-check, tests, coverage
```

## API Specifications

- **Agent API**: Defined in `openapi/agent-api.yaml` (single source of truth)
- **Web API**: RESTful JSON API at `/api/v1/web/*`
- **Control API**: Automation-friendly endpoints at `/api/v1/control/*`
- **Versioning**: Semantic versioning with `x-agent-api-version` header

## Key Libraries

- **name-that-hash**: Hash type identification and analysis
- **mongoose**: MongoDB ODM with TypeScript support
- **bullmq**: Message queue for task distribution
- **zod**: Runtime type validation and schema definition
- **pino**: Structured logging
- **@aws-sdk/client-s3**: S3-compatible object storage client
- **bcrypt-ts**: Pure JavaScript bcrypt implementation (no native addons)

## Type Safety

- Shared TypeScript types between backend and frontend
- Zod schemas for runtime validation
- Mongoose schemas with TypeScript inference
- OpenAPI-generated types for Agent API
