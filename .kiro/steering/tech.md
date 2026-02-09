# Technology Stack

## MERN Stack Architecture

HashHive is a greenfield MERN application with TypeScript throughout, based on the CipherSwarm architecture design.

### Backend

- **Runtime**: Node.js LTS (for MongoDB driver compatibility)
- **Framework**: Fastify (high-performance, schema-based validation)
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod for all data shapes (single source of truth)
- **Authentication**: JWT tokens for Agent API, HttpOnly session cookies for Dashboard API
- **Queue System**: BullMQ + Redis for background jobs and task distribution
- **Object Storage**: S3-compatible (MinIO in development) via @aws-sdk/client-s3
- **Testing**: Vitest for all tests, Testcontainers for integration tests
- **Logging**: Pino with structured logging
- **WebSockets**: @fastify/websocket for real-time dashboard updates

### Frontend

- **Framework**: React 19 with Vite (not Next.js, not CRA)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (copied into project via CLI)
- **Forms**: React Hook Form + Zod resolvers
- **Data Fetching**: TanStack Query v5 (React Query) for all server state
- **State Management**: Zustand for client-side UI state (no Redux, no Context API)
- **Real-time**: WebSocket/SSE client for live updates
- **Testing**: Vitest + Testing Library for components, Playwright for E2E

### Infrastructure

- **Containerization**: Docker with compose for local development
- **Caching**: Redis for sessions, queue state, and pub/sub
- **Configuration**: dotenv + centralized config module (12-factor)

### Tooling

- **Package Manager**: pnpm (exclusively, no npm or yarn)
- **Monorepo**: Turborepo with pnpm workspaces
- **Linting**: Oxlint (fallback to Biome if needed)
- **Formatting**: Oxfmt (fallback to Prettier if needed)
- **Build**: Turborepo for task orchestration and caching

## Common Commands

### Development

```bash
# Start all services
pnpm dev                 # Start both backend and frontend via Turborepo
pnpm --filter backend dev    # Start backend only
pnpm --filter frontend dev   # Start frontend only

# Docker services
docker compose up        # Start MongoDB, Redis, MinIO
```

### Testing

```bash
pnpm test                # Run all tests via Turborepo
pnpm --filter backend test   # Run backend tests
pnpm --filter frontend test  # Run frontend tests
pnpm test:e2e            # Run E2E tests (Playwright)
```

### Building & Linting

```bash
pnpm build               # Build all packages via Turborepo
pnpm lint                # Lint all code with Oxlint
pnpm format              # Format all code with Oxfmt/Prettier
pnpm type-check          # TypeScript type checking
```

### Turborepo

```bash
turbo run build          # Build all packages with caching
turbo run test --filter=backend  # Run backend tests only
turbo run lint --no-cache        # Lint without cache
```

## API Specifications

- **Agent API**: Defined in `openapi/agent-api.yaml` (single source of truth for Go-based agents)
  - High-throughput REST API (10K req/s bursts)
  - Token-based authentication
  - Bulk operations for hash submissions
  - Endpoints: `/api/v1/agent/*`
- **Dashboard API**: RESTful JSON API at `/api/v1/dashboard/*`
  - Session-based authentication for web UI
  - Low traffic (1-3 concurrent users)
  - Standard REST endpoints (no tRPC)

## Key Libraries

- **fastify**: High-performance HTTP framework with schema validation
- **@fastify/websocket**: WebSocket support for real-time updates
- **mongoose**: MongoDB ODM with TypeScript support
- **bullmq**: Message queue for task distribution
- **zod**: Runtime type validation and schema definition (single source of truth)
- **pino**: Structured logging
- **@aws-sdk/client-s3**: S3-compatible object storage client
- **name-that-hash**: Hash type identification and analysis

## Type Safety

- **Zod schemas in `shared/` package** are the single source of truth
- All TypeScript types inferred from Zod schemas using `z.infer<typeof schema>`
- No duplicate manual TypeScript interfaces
- Shared schemas consumed by both backend (Fastify validation) and frontend (form validation, TanStack Query typing)
- Mongoose schemas with TypeScript inference
- OpenAPI-generated types for Agent API
