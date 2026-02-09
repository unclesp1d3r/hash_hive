# hash_hive: Claude Code Steering Document

## Project Overview

hash_hive is a 2026 TypeScript reimplementation of [CipherSwarm](https://github.com/unclesp1d3r/CipherSwarm), a distributed hash cracking management system originally built on Ruby on Rails with PostgreSQL. This project reimplements it using a modern TypeScript stack running on Bun, serving as both a functional tool and a technology evaluation exercise.

**Production context:** This system runs in a private lab environment managing 7 cracking rigs. It is not publicly exposed or under sustained high load. The agent API handles periodic bursts when rigs submit cracked hashes, request work units, and send heartbeats. The web dashboard serves 1-3 concurrent human users. Do not over-engineer for scale; optimize for correctness, clarity, and developer experience.

**Reference implementation:** CipherSwarm's architecture, data models, and agent communication patterns are the source of truth for functional requirements. The Go-based hashcat-agent is the primary API consumer. The original uses PostgreSQL, so this reimplementation aligns on database choice.

## Tech Stack

All code must be TypeScript. No plain JavaScript files except configuration where TypeScript is not supported.

### Runtime

- **Bun** (latest stable, currently 1.3.x) as the JavaScript runtime, package manager, and test runner.
- Bun was chosen to use its native `Bun.serve()` HTTP server, native PostgreSQL driver (`Bun.SQL`), and built-in tooling (test runner, package management).
- Do not use Node.js or Deno as runtime.

### Monorepo Structure

- **Turborepo** for task orchestration with **Bun workspaces** for package linking.
- Packages: `backend/`, `frontend/`, `shared/` (Drizzle schema, Zod schemas, types, constants), `openapi/` (OpenAPI spec for agent API)
- Keep `turbo.json` minimal. Let Bun workspaces handle package linking.
- Do not introduce Nx, Lerna, or other monorepo tools.

### Backend

- **Hono** as the API framework, running natively on `Bun.serve()`. Do not use Express or Fastify. Hono uses Web Standard Request/Response objects with zero adapter overhead on Bun.
- **Drizzle ORM** for PostgreSQL schema, queries, migrations, and type-safe database access.
- **Bun.SQL** may be used directly for performance-critical bulk operations on the agent ingestion path if Drizzle adds unwanted overhead. Drizzle and Bun.SQL can share the same PostgreSQL connection.
- **Zod** for API input validation. Use **drizzle-zod** to generate Zod schemas from Drizzle table definitions where applicable.
- **hono/websocket** or Server-Sent Events for real-time dashboard updates (agent heartbeats, cracking progress, job status).

#### API Architecture

The backend exposes two distinct API surfaces on the same Hono instance:

1. **Agent API (REST + OpenAPI):** Consumed by Go-based cracking agents. Must follow a documented OpenAPI spec. Agents submit cracked hashes in bulk, request work units, report status, and send heartbeats. Design for batch operations (bulk inserts, batch updates) rather than individual row writes.

2. **Dashboard API (REST):** Consumed by the React frontend via TanStack Query. Low traffic (1-3 users). Standard REST endpoints with Zod validation on both sides. Separate routes via prefixes (`/api/v1/agent/`, `/api/v1/dashboard/`).

#### Database

- **PostgreSQL** as the sole data store. Do not introduce MongoDB, Redis, or other databases unless a specific, justified need arises.
- All schema is defined in Drizzle table definitions in the `shared/` package. These are the single source of truth for data shapes.
- Use Drizzle Kit for migrations (`drizzle-kit generate`, `drizzle-kit migrate`).
- For the agent bulk ingestion path: if Drizzle's insert overhead matters, drop to raw `Bun.SQL` with parameterized queries. Measure before optimizing.
- Design indexes for the obvious hot paths up front: hash lookups by value, pending work units by attack/campaign ID, agent status queries.

### Frontend

- **React 19** bootstrapped with **Vite** (not Create React App, not Next.js)
- **shadcn/ui** with **Tailwind CSS** for all UI components. Copy components into the project via the shadcn CLI. Do not use Material UI, Chakra UI, Ant Design, or other component libraries.
- **TanStack Query (React Query v5)** for all server state (API data fetching, caching, background refetch)
- **Zustand** for client-side UI state (selected agents, filter preferences, active job tracking, dashboard layout state). Do not use Redux, MobX, or React Context for state management.
- **React Hook Form** with Zod resolvers for form handling where forms exist.

### Shared Schema and Validation

The `shared/` package is the single source of truth for all data shapes:

1. **Drizzle table definitions** define the database schema and generate migrations.
2. **drizzle-zod** generates Zod schemas from Drizzle tables for API validation.
3. **z.infer** derives TypeScript types from Zod schemas. Do not manually define duplicate TypeScript interfaces.
4. Custom Zod schemas (for API payloads that don't map 1:1 to database tables) live alongside the generated ones in `shared/`.

Flow: Drizzle tables → drizzle-zod → Zod schemas → TypeScript types. One direction, no duplication.

### Testing

- **bun:test** (Bun's built-in test runner) for all tests. Do not use Jest or Vitest.
- **Testing Library** (`@testing-library/react`) for component tests.
- Test the hot paths first: hash submission ingestion, work unit distribution, agent heartbeat processing.

### Linting and Formatting

- **Biome** for linting, formatting, and import sorting. Single tool, single `biome.json` config.
- Do not use ESLint, Prettier, or eslint-plugin-* packages.

## Architectural Principles

1. **Agents are the primary API consumer.** The Go-based hashcat-agent defines the contract. The web dashboard is secondary. Never break the agent API to improve the dashboard experience.

2. **Bulk over individual.** Every agent-facing endpoint that accepts data should support batch operations. A single hash submission request may contain thousands of results.

3. **Schema flows from Drizzle.** Table definitions in the shared package are the source of truth. Zod schemas, TypeScript types, and migrations all derive from them. Do not define data shapes anywhere else first.

4. **No premature abstraction.** This is a proof-of-concept with a clear scope. Do not introduce service layers, dependency injection frameworks, or architectural patterns (hexagonal, clean architecture, etc.) unless a specific problem demands it. Hono route handlers calling Drizzle queries directly is fine.

5. **WebSocket/SSE for the dashboard, REST for agents.** Agents poll for work and submit results over REST. The dashboard receives live updates via push. These are different communication patterns for different consumers.

6. **Measure before optimizing.** The lab runs 7 rigs. Default Drizzle queries, default connection pool settings, and straightforward indexes will handle this. Do not introduce caching layers, queue systems, or connection tuning without evidence of an actual bottleneck.

## File Structure

```
hash_hive/
  turbo.json
  package.json                # Bun workspace root
  packages/
    shared/
      src/
        db/
          schema.ts           # Drizzle table definitions (source of truth)
          migrations/          # Generated by drizzle-kit
        schemas/               # Zod schemas (drizzle-zod generated + custom)
        types/                 # Inferred types (z.infer exports)
    backend/
      src/
        routes/
          agent/               # Agent-facing REST API (/api/v1/agent/*)
          dashboard/           # Dashboard-facing REST API (/api/v1/dashboard/*)
        db/                    # Drizzle client setup, connection config
        middleware/            # Hono middleware (auth, logging, etc.)
        services/              # Business logic (only when handlers get complex)
      drizzle.config.ts        # Drizzle Kit configuration
    frontend/
      src/
        components/            # shadcn/ui components and custom components
        hooks/                 # Custom hooks (TanStack Query wrappers, etc.)
        stores/                # Zustand stores
        pages/                 # Route-level page components
        lib/                   # Utilities, API client config
    openapi/                   # OpenAPI spec for agent API
```

## What NOT to Introduce

- **Next.js, Remix, or any meta-framework:** Vite + React for the frontend, Hono for the backend.
- **Express.js or Fastify:** Hono runs natively on Bun.serve() without a compatibility layer.
- **tRPC:** Unnecessary complexity for 1-3 dashboard users. Standard REST with Zod validation is sufficient.
- **MongoDB or Mongoose:** PostgreSQL with Drizzle is the chosen data layer. The original CipherSwarm also uses PostgreSQL.
- **Prisma:** Ships a Rust query engine binary, has had Bun compatibility issues, and is heavier than Drizzle for this use case.
- **Redux, MobX, Recoil, Jotai:** Zustand + TanStack Query covers all state needs.
- **ESLint + Prettier:** Biome handles linting and formatting.
- **Node.js or Deno as runtime:** Bun is the runtime. All scripts run via `bun run`.
- **GraphQL:** REST with OpenAPI is the right fit for agent communication.
- **Docker Compose for development:** Keep it simple. `turbo dev` should start everything.
- **Microservices architecture:** This is a single application with two API surfaces.
- **Redis or other caching layers:** Premature for 7 rigs. Add only if PostgreSQL query performance is measured and found wanting.
