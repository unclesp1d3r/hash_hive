# Technology Stack

## MERN Stack Architecture

HashHive is a greenfield MERN application with TypeScript throughout, based on the CipherSwarm architecture design.

### Backend

- **Runtime**: Node.js LTS with TypeScript
- **Framework**: Express or Fastify with modular routers per domain
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod for request/response schemas and DTOs
- **Authentication**: JWT-based stateless auth for APIs, HttpOnly session cookies for web
- **Queue System**: BullMQ + Redis for background jobs and task distribution
- **Object Storage**: S3-compatible (MinIO in development) via Node SDK
- **Testing**: Jest + supertest for HTTP tests, Testcontainers for integration tests
- **Logging**: Pino with OpenTelemetry-compatible exporters

### Frontend

- **Framework**: Next.js (React, TypeScript) with App Router
- **Styling**: Tailwind CSS
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

## Common Commands

### Development

```bash
# Backend
npm run dev              # Start Express API server
npm run test             # Run Jest unit tests
npm run test:integration # Run integration tests with Testcontainers

# Frontend
npm run dev              # Start Next.js dev server
npm run build            # Build production bundle
npm run test             # Run component tests
npm run test:e2e         # Run Playwright E2E tests

# Full Stack
docker compose up        # Start all services (API, web, mongo, redis, minio)
```

### Testing

```bash
npm run test:watch       # Watch mode for unit tests
npm run test:coverage    # Generate coverage reports
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript compiler checks
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

## Type Safety

- Shared TypeScript types between backend and frontend
- Zod schemas for runtime validation
- Mongoose schemas with TypeScript inference
- OpenAPI-generated types for Agent API
