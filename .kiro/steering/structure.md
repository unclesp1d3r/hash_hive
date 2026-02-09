# Project Structure

## Repository Organization

HashHive follows a Turborepo + pnpm workspaces monorepo structure with separate backend and frontend applications sharing common schemas.

```text
/
├── packages/
│   ├── backend/          # Node.js + Fastify API
│   │   ├── src/
│   │   │   ├── models/       # Mongoose schemas and models
│   │   │   ├── routes/       # Fastify route handlers by domain
│   │   │   │   ├── agent/    # Agent API routes (/api/v1/agent/*)
│   │   │   │   └── dashboard/# Dashboard API routes (/api/v1/dashboard/*)
│   │   │   ├── services/     # Business logic layer (optional, only when needed)
│   │   │   ├── plugins/      # Fastify plugins (auth, websocket, etc.)
│   │   │   ├── utils/        # Helper functions
│   │   │   └── config/       # Configuration management
│   │   ├── tests/
│   │   │   ├── unit/         # Service and utility tests
│   │   │   ├── integration/  # API tests with Testcontainers
│   │   │   └── fixtures/     # Test data and factories
│   │   └── package.json
│   │
│   ├── frontend/         # React 19 + Vite UI
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   │   ├── ui/       # shadcn/ui base components
│   │   │   │   └── features/ # Feature-specific components
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── lib/          # Utilities and API client config
│   │   │   ├── hooks/        # Custom React hooks (TanStack Query wrappers)
│   │   │   └── stores/       # Zustand stores for UI state
│   │   └── package.json
│   │
│   ├── shared/           # Shared Zod schemas and inferred types
│   │   ├── src/
│   │   │   ├── schemas/  # Zod schema definitions (single source of truth)
│   │   │   └── types/    # Inferred types (z.infer exports)
│   │   └── package.json
│   │
│   └── openapi/          # API specifications
│       └── agent-api.yaml    # Agent API OpenAPI spec
│
├── docs/                 # Documentation
│   ├── MERN_proposal.md
│   ├── MERN_GUIDANCE.md
│   └── v2_rewrite_implementation_plan/
│
├── docker-compose.yml    # Local development stack (MongoDB, Redis, MinIO)
├── turbo.json            # Turborepo configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── package.json          # Root package.json
```

## Backend Architecture

**No premature abstraction**: Fastify route handlers can call Mongoose models directly. Service layers are optional and only introduced when handlers become complex.

### Route Organization

- **Agent API routes** (`src/routes/agent/`): High-throughput REST API for Go-based agents
  - Token-based authentication
  - Bulk operations (insertMany, bulkWrite) for hash submissions
  - Endpoints: sessions, heartbeat, tasks/next, tasks/:id/report
- **Dashboard API routes** (`src/routes/dashboard/`): Standard REST API for React frontend
  - Session-based authentication
  - Low traffic (1-3 concurrent users)
  - Standard CRUD operations

### Optional Service Modules

Only create service modules when route handlers become complex:

- **AuthService**: Login, logout, token/session management
- **AgentService**: Registration, heartbeat, capability detection
- **CampaignService**: Campaign lifecycle, attack orchestration
- **TaskDistributionService**: Keyspace partitioning, task queueing
- **ResourceService**: File uploads, hash list parsing
- **HashAnalysisService**: Hash type identification, hashcat mode mapping
- **EventService**: WebSocket/SSE broadcasting

## MongoDB Collections

- **users**: User accounts with authentication and audit fields
- **projects**: Project definitions with settings
- **project_users**: Many-to-many user-project-role associations
- **roles**: Role definitions (admin, operator, analyst, agent_owner)
- **operating_systems**: Static catalog for agent capabilities
- **agents**: Agent registration, status, capabilities, hardware profiles
- **agent_errors**: Error logs with severity and context
- **campaigns**: Campaign definitions with hash lists and metadata
- **attacks**: Attack configurations with mode, resources, and dependencies
- **tasks**: Task assignments with progress and results
- **hash_lists**: Hash list metadata with file references
- **hash_items**: Individual hashes with crack status
- **hash_types**: Hashcat mode catalog
- **word_lists**, **rule_lists**, **mask_lists**: Resource metadata

## API Route Structure

### Agent API (`/api/v1/agent/*`)

- **Purpose**: High-throughput API for Go-based hashcat agents (10K req/s bursts)
- **Authentication**: Token-based
- **Contract**: Defined by OpenAPI specification in `openapi/agent-api.yaml`
- **Key endpoints**: 
  - `POST /agent/sessions` - Agent authentication
  - `POST /agent/heartbeat` - Status updates
  - `POST /agent/tasks/next` - Request work
  - `POST /agent/tasks/:id/report` - Submit results (bulk operations)

### Dashboard API (`/api/v1/dashboard/*`)

- **Purpose**: Standard REST API for React frontend (1-3 concurrent users)
- **Authentication**: Session-based (HttpOnly cookies)
- **Pattern**: Standard REST CRUD operations (no tRPC)
- **Key endpoints**: Projects, agents, campaigns, attacks, tasks, resources, hash analysis

## Frontend Structure

- **Vite + React 19**: No Next.js, no server components
- **TanStack Query**: All server state (API data fetching, caching, background refetch)
- **Zustand**: Client-side UI state (selected agents, filters, dashboard layout)
- **shadcn/ui**: Components copied into project via CLI (no external component library)
- **React Hook Form + Zod**: Form handling with shared Zod schemas from `shared/` package
- **WebSocket/SSE**: Real-time updates for dashboard (agent heartbeats, crack results)

## Testing Organization

- **Vitest for all tests** (no Jest)
- **Backend Unit Tests**: Service logic, utilities, validation schemas
- **Backend Integration Tests**: API endpoints with Testcontainers (MongoDB, Redis, MinIO)
- **Frontend Component Tests**: Testing Library for React components
- **E2E Tests**: Playwright for complete user workflows

## Configuration

- **Environment variables**: `.env` files with dotenv
- **Centralized config**: Single config module with Zod validation
- **12-factor principles**: All config via environment variables
- **No Docker Compose for development**: `turbo dev` starts everything (MongoDB, Redis, MinIO run separately)

## Naming Conventions

- **Files**: kebab-case (e.g., `agent-service.ts`)
- **Components**: PascalCase (e.g., `AgentList.tsx`)
- **Functions**: camelCase (e.g., `createCampaign`)
- **Types/Interfaces**: PascalCase (e.g., `AgentStatus`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **MongoDB Collections**: snake_case (e.g., `hash_lists`)
