# hash_hive: Claude Code Steering Document

## Project Overview

hash_hive is a MERN-variant proof-of-concept of [CipherSwarm](https://github.com/unclesp1d3r/CipherSwarm), a distributed hash cracking management system originally built on Ruby on Rails. This project reimplements it using a modern JavaScript/TypeScript stack, serving as both a functional tool and a technology evaluation exercise.

**Production context:** This system runs in a private lab environment managing 7 cracking rigs. It is not publicly exposed. The agent API must handle sustained bursts of 10K requests/second during productive cracking runs. The web dashboard serves 1-3 concurrent human users monitoring progress.

**Reference implementation:** CipherSwarm's architecture, data models, and agent communication patterns are the source of truth for functional requirements. The Go-based hashcat-agent is the primary API consumer.

## Tech Stack

All code must be TypeScript. No plain JavaScript files except configuration where TypeScript is not supported.

### Monorepo Structure

- **Turborepo** with **pnpm workspaces**
- Packages: `backend/`, `frontend/`, `shared/` (Zod schemas, types, constants), `openapi/` (OpenAPI spec for agent API)
- Keep `turbo.json` minimal. Let pnpm workspaces handle package linking.
- Do not introduce Nx, Lerna, or other monorepo tools.

### Backend

- **Fastify** (not Express, not Hono) as the API framework
- **Mongoose** for MongoDB ODM
- **Zod** for all input validation; compile Zod schemas to JSON Schema for Fastify's built-in validation where appropriate
- **@fastify/websocket** or Server-Sent Events for real-time dashboard updates (agent heartbeats, cracking progress, job status)

#### API Architecture

The backend exposes two distinct API surfaces:

1. **Agent API (REST + OpenAPI):** Consumed by Go-based cracking agents. Must follow a documented OpenAPI spec. Agents submit cracked hashes in bulk, request work units, report status, and send heartbeats. This is the high-throughput path (10K req/s bursts). Design for bulk operations (`insertMany`, `bulkWrite`) rather than individual document writes.

2. **Dashboard API (REST):** Consumed by the React frontend via TanStack Query. Low traffic (1-3 users). Do not use tRPC; use standard REST endpoints with Zod validation on both sides. Keep the same Fastify instance; separate routes via prefixes (`/api/v1/agent/`, `/api/v1/dashboard/`).

#### MongoDB Performance Guidelines

- Use `bulkWrite()` and `insertMany({ ordered: false })` for hash result ingestion.
- Write concern for hash submissions: `{ w: 1, j: false }` is acceptable in this lab environment.
- Design compound indexes for hot query paths up front: hash lookups by value, pending work units by attack ID, agent status queries.
- Use a single shared Mongoose connection pool (default 100 connections is fine).
- Do not create new connections per request.

### Frontend

- **React 19** bootstrapped with **Vite** (not Create React App, not Next.js)
- **shadcn/ui** with **Tailwind CSS** for all UI components. Copy components into the project via the shadcn CLI. Do not use Material UI, Chakra UI, Ant Design, or other component libraries.
- **TanStack Query (React Query v5)** for all server state (API data fetching, caching, background refetch)
- **Zustand** for client-side UI state (selected agents, filter preferences, active job tracking, dashboard layout state). Do not use Redux, MobX, or React Context for state management.
- **React Hook Form** with Zod resolvers for form handling where forms exist.

### Shared Validation

- **Zod** is the single source of truth for all data shapes. Define schemas in the `shared/` package. Infer TypeScript types from Zod schemas (`z.infer<typeof schema>`). Do not manually define duplicate TypeScript interfaces.
- Shared schemas are consumed by both backend (Fastify validation) and frontend (TanStack Query response typing, form validation).

### Testing

- **Vitest** for all tests (unit and integration). Do not use Jest.
- **Testing Library** (`@testing-library/react`) for component tests.
- Test the hot paths first: hash submission ingestion, work unit distribution, agent heartbeat processing.

### Linting and Formatting

- **Oxlint** for linting. If Oxlint configuration becomes problematic, fall back to **Biome** as the all-in-one alternative.
- **Oxfmt** for formatting if stable; otherwise use **Prettier** as the formatter.
- Do not use ESLint or eslint-plugin-* packages.

### Runtime

- **Node.js** (not Bun, not Deno). Mongoose and the MongoDB driver have the strongest compatibility and testing on Node.js. Do not optimize for startup time at the expense of driver reliability.

### Package Manager

- **pnpm** exclusively. Do not use npm or yarn. All workspace dependencies are managed via pnpm workspaces.

## Architectural Principles

1. **Agents are the primary API consumer.** The Go-based hashcat-agent defines the contract. The web dashboard is secondary. Never break the agent API to improve the dashboard experience.

2. **Bulk over individual.** Every agent-facing endpoint that accepts data should support batch operations. A single hash submission request may contain thousands of results.

3. **Zod is the schema layer.** If a data shape exists, it should be a Zod schema in `shared/`. Types flow from schemas, not the other way around.

4. **No premature abstraction.** This is a proof-of-concept with a clear scope. Do not introduce service layers, dependency injection frameworks, or architectural patterns (hexagonal, clean architecture, etc.) unless a specific problem demands it. Fastify route handlers calling Mongoose models directly is fine.

5. **WebSocket/SSE for the dashboard, REST for agents.** Agents poll for work and submit results over REST. The dashboard receives live updates via push. These are different communication patterns for different consumers.

## File Structure

```
hash_hive/
  turbo.json
  pnpm-workspace.yaml
  package.json
  packages/
    shared/             # Zod schemas, inferred types, constants
      src/
        schemas/        # Zod schema definitions
        types/          # Inferred types (z.infer exports)
    backend/
      src/
        routes/
          agent/        # Agent-facing REST API (/api/v1/agent/*)
          dashboard/    # Dashboard-facing REST API (/api/v1/dashboard/*)
        models/         # Mongoose models
        plugins/        # Fastify plugins (auth, websocket, etc.)
        services/       # Business logic (only when handlers get complex)
    frontend/
      src/
        components/     # shadcn/ui components and custom components
        hooks/          # Custom hooks (TanStack Query wrappers, etc.)
        stores/         # Zustand stores
        pages/          # Route-level page components
        lib/            # Utilities, API client config
    openapi/            # OpenAPI spec for agent API
```

## What NOT to Introduce

- Next.js, Remix, or any meta-framework
- tRPC (unnecessary complexity for 1-3 dashboard users)
- Express.js (Fastify handles this workload better)
- Redux, MobX, Recoil, Jotai (Zustand + TanStack Query covers all state needs)
- Prisma or Drizzle (their MongoDB support is inferior to Mongoose)
- ESLint + Prettier (use Oxlint/Biome instead)
- Bun or Deno as runtime (Node.js for driver compatibility)
- GraphQL (REST with OpenAPI is the right fit for agent communication)
- Docker Compose for development (keep it simple; `turbo dev` should start everything)
- Microservices architecture (this is a single application with two API surfaces)
