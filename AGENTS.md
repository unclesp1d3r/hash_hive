# AGENTS.md

This file provides guidance to AI coding assistants (including WARP) when working with code in this repository.

## Project overview

HashHive is a greenfield MERN (MongoDB, Express, React, Node.js) implementation that replaces the legacy Rails-based CipherSwarm platform. It orchestrates distributed password cracking with hashcat across multiple agents, providing:

- Agent management and monitoring
- Campaign and attack orchestration with DAG-based dependencies
- Queue-based task distribution over a shared keyspace
- Resource management for hash lists, wordlists, rulelists, and masklists
- Real-time dashboards for agents, campaigns, and crack results
- Project-scoped multi-tenancy and role-based access control

Most of the current repository content is design and planning documentation; the codebase structure and commands below describe the intended architecture once implementation is in place.

## Repository layout and major components (planned)

High-level monorepo structure (see `.kiro/steering/structure.md` for the authoritative layout):

```text path=null start=null
/
├── backend/              # Node.js + Express/Fastify API
│   ├── src/
│   │   ├── models/       # Mongoose schemas and models
│   │   ├── routes/       # HTTP route handlers grouped by domain (auth, agents, campaigns, etc.)
│   │   ├── services/     # Business logic layer used by routes and queues
│   │   ├── middleware/   # Auth, validation, error handling
│   │   ├── types/        # Backend-specific and shared TS types
│   │   ├── utils/        # Cross-cutting helpers (logging, IDs, etc.)
│   │   └── config/       # Centralized config + env validation
│   ├── tests/
│   │   ├── unit/         # Service + utility tests
│   │   ├── integration/  # API + queue integration tests (Testcontainers)
│   │   └── fixtures/     # Test data + factories
│   └── package.json
│
├── frontend/             # Next.js (App Router) web UI
│   ├── app/              # Routes & layouts
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   └── features/     # Feature-level UIs (dashboard, campaigns, agents, resources)
│   ├── lib/              # API clients, formatting, helpers
│   ├── hooks/            # Custom React hooks
│   ├── types/            # Frontend shared types
│   └── package.json
│
├── shared/
│   └── types/            # Cross-package TypeScript types and schemas
│
├── openapi/
│   └── agent-api.yaml    # Agent API OpenAPI spec (single source of truth)
│
├── docs/                 # Extended design and implementation docs
│   ├── MERN_proposal.md
│   └── v2_rewrite_implementation_plan/
│
├── .kiro/                # Product/tech steering and specs (authoritative design)
│   ├── steering/
│   │   ├── product.md
│   │   ├── structure.md
│   │   └── tech.md
│   └── specs/
│       └── mern-migration/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
│
└── docker-compose.yml    # Local development stack (MongoDB, Redis, MinIO, backend, frontend)
```

When adding new modules or services, follow this monorepo layout and keep domain logic in the backend `services/` layer, not in route handlers.

## Architectural big picture

### Backend service architecture

The backend is a Node.js + TypeScript service with a clear layering:

- **Routes / Controllers (`src/routes/`)**
  - HTTP endpoints grouped by API surface: Web API, Agent API, Control API
  - Thin controllers: parse/validate input, call service layer, map results to HTTP responses
- **Services (`src/services/`)**
  - Encapsulate business logic and coordinate models, queues, and events
  - Key services (from `.kiro/specs/mern-migration/design.md`):
    - `AuthService`: login/logout, JWT/session management, password hashing
    - `ProjectService`: project CRUD, membership, role assignment and enforcement
    - `AgentService`: agent registration, capability detection, heartbeat handling, error logging
    - `CampaignService`: campaign lifecycle (create, validate DAG, start/pause), attack configuration
    - `TaskDistributionService`: keyspace partitioning, task generation, queueing, assignment, progress tracking
    - `ResourceService`: upload and manage hash lists/wordlists/rulelists/masklists via S3-compatible storage
    - `HashAnalysisService`: hash-type identification, hashcat mode mapping, validation
    - `EventService`: real-time event broadcasting over WebSockets/SSE with project-level filtering
- **Data access layer (`src/models/`)**
  - Mongoose models for core collections: `users`, `projects`, `project_users`, `agents`, `campaigns`, `attacks`, `tasks`, `hash_lists`, `hash_items`, `hash_types`, and resource collections
  - Schemas use timestamps, indexes for common queries, and TypeScript-typed interfaces
- **Middleware (`src/middleware/`)**
  - Authentication/authorization (JWT + HttpOnly sessions, role- and project-scoped access checks)
  - Validation using Zod schemas for request/response bodies
  - Centralized error handling that returns structured error responses with machine-readable codes and request IDs
- **Infrastructure components**
  - MongoDB as primary datastore
  - Redis + BullMQ for queues (task distribution, background work, dead-letter handling)
  - S3-compatible storage (MinIO in development) for large artifacts such as hash lists and wordlists

The design documents in `.kiro/specs/mern-migration/design.md` and `.kiro/specs/mern-migration/tasks.md` are the canonical reference for how services, models, and queues interact. When implementing or modifying backend functionality, cross-check your changes against these specs.

### API surfaces

There are three primary API surfaces, all backed by the same service and model layer:

- **Agent API (`/api/v1/agent/*`)**
  - Token-authenticated API for hashcat agents
  - Defined by `openapi/agent-api.yaml`; this spec drives both server implementation and client SDK generation
  - Core endpoints: `POST /agent/sessions`, `POST /agent/heartbeat`, `POST /agent/tasks/next`, `POST /agent/tasks/:id/report`
- **Web API (`/api/v1/web/*`)**
  - Session-authenticated API used by the Next.js frontend
  - Exposes project, agent, campaign, task, resource, and hash-analysis operations via RESTful JSON endpoints
- **Control API (`/api/v1/control/*`)**
  - Automation-focused API surface for n8n, MCP tools, and scripts
  - Favors idempotent operations and stable pagination for integration workflows

Agent API contract tests and other API contract tests should validate responses against the OpenAPI spec to keep server and clients in sync.

### Frontend architecture

The frontend is a Next.js App Router application in TypeScript:

- Uses Tailwind CSS and shadcn/ui for UI components
- Forms are built with React Hook Form + Zod schemas
- Data fetching and caching rely on React Query (TanStack Query)
- Real-time updates are delivered via a dedicated event client (WebSockets/SSE) that integrates with React Query or custom hooks
- Feature areas map closely to backend domains: dashboard, campaigns, agents, resources, and hash analysis

Server components handle initial data loading where appropriate, with client components used for interactive flows and real-time views.

### Data model and collections (summary)

The core collections in MongoDB (see `.kiro/steering/structure.md` and `.kiro/specs/mern-migration/design.md` for full details) include:

- **Identity & access**: `users`, `projects`, `project_users`, `roles`
- **Agents & telemetry**: `operating_systems`, `agents`, `agent_errors`
- **Campaign orchestration**: `campaigns`, `attacks` (with DAG dependencies), `tasks` (work ranges, progress, results)
- **Resources**: `hash_lists`, `hash_items`, `hash_types`, `word_lists`, `rule_lists`, `mask_lists`

Updates are generally non-destructive, relying on explicit status fields and metadata rather than overwriting important state.

## Development and runtime commands (planned)

At the time of writing, this repository primarily contains design documents; actual `package.json` scripts and Docker configurations may not yet exist. The commands below are taken from `.kiro/steering/tech.md` and represent the intended interface once backend and frontend packages are in place.

### Backend (inside `backend/`)

```bash path=null start=null
npm install              # Install backend dependencies
npm run dev              # Start Express/Fastify API server in dev mode
npm run test             # Run Jest unit tests
npm run test:integration # Run integration tests with Testcontainers
npm run lint             # Run ESLint
npm run type-check       # Run TypeScript checks
```

### Frontend (inside `frontend/`)

```bash path=null start=null
npm install       # Install frontend dependencies
npm run dev       # Start Next.js dev server
npm run build     # Build production bundle
npm run test      # Run component/unit tests
npm run test:e2e  # Run Playwright end-to-end tests
```

### Full stack and infrastructure

```bash path=null start=null
docker compose up  # Start MongoDB, Redis, MinIO, backend, and frontend locally
```

> Note: Once `package.json` and `docker-compose.yml` files are added, always prefer the scripts and commands defined there as the source of truth. For running a single test, use the patterns supported by the configured test runner (e.g., Jest’s `--testNamePattern` or file path filters as defined in each package’s scripts).

## Testing strategy (planned)

The intended testing strategy, as defined in `.kiro/specs/mern-migration/design.md` and `.kiro/specs/mern-migration/tasks.md`, is:

- **Backend**
  - Jest unit tests focused on service-layer business logic, utilities, and validation schemas
  - Jest + supertest integration tests for API endpoints
  - Testcontainers-based integration tests spinning up MongoDB, Redis, and MinIO
  - Contract tests validating responses against the OpenAPI specs (especially Agent API)
- **Frontend**
  - Jest + React Testing Library for components, forms, and client logic
  - Playwright E2E tests covering authentication, campaign creation, agent workflows, and real-time updates
- **End-to-end validation & migration**
  - E2E flows from campaign creation to completion
  - Migration tooling tests for data export from Rails, transformation into MongoDB documents, import, and validation

When adding new features, look for the appropriate test suite in `backend/tests/` or frontend test directories and mirror existing patterns.

## Design and documentation sources

Before making major changes, consult these documents:

- `.kiro/steering/product.md` — high-level product overview and core capabilities
- `.kiro/steering/structure.md` — repository and module structure, collection list, and API route structure
- `.kiro/steering/tech.md` — technology stack, common commands, and key libraries
- `.kiro/specs/mern-migration/requirements.md` — detailed functional and non-functional requirements
- `.kiro/specs/mern-migration/design.md` — end-to-end architecture, data models, and API designs
- `.kiro/specs/mern-migration/tasks.md` — implementation task breakdown mapping directly to requirements
- `docs/v2_rewrite_implementation_plan/*` and `docs/MERN_proposal.md` — historical and supplementary context on the migration from CipherSwarm

These documents are the primary "source of truth" for architecture and behavior; keep code changes aligned with them and update the docs when behavior diverges.

## Agent-specific notes

- Prefer mermaid diagrams for any new architectural or sequence diagrams added to this repository’s documentation.
- Treat `.kiro/**` as canonical planning/steering context; align automated refactors and major structural changes with those documents rather than inferring architecture solely from the current code.
