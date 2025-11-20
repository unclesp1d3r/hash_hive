# Project Structure

## Repository Organization

HashHive follows a monorepo structure with separate backend and frontend applications sharing common types.

```text
/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── models/       # Mongoose schemas and models
│   │   ├── routes/       # Express routers by domain
│   │   ├── services/     # Business logic layer
│   │   ├── middleware/   # Auth, validation, error handling
│   │   ├── types/        # Shared TypeScript types
│   │   ├── utils/        # Helper functions
│   │   └── config/       # Configuration management
│   ├── tests/
│   │   ├── unit/         # Service and utility tests
│   │   ├── integration/  # API tests with Testcontainers
│   │   └── fixtures/     # Test data and factories
│   └── package.json
│
├── frontend/             # Next.js + React UI
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui base components
│   │   └── features/     # Feature-specific components
│   ├── lib/              # Utilities and API clients
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript types
│   └── package.json
│
├── shared/               # Shared types and schemas
│   └── types/            # Common TypeScript definitions
│
├── openapi/              # API specifications
│   └── agent-api.yaml    # Agent API OpenAPI spec
│
├── docs/                 # Documentation
│   ├── MERN_proposal.md
│   └── v2_rewrite_implementation_plan/
│
└── docker-compose.yml    # Local development stack
```

## Backend Service Modules

Each service module is self-contained with routes, controllers, service layer, and data access:

- **auth-service**: Users, roles, sessions, tokens, project membership
- **project-service**: Multi-project management, role assignments, permissions
- **agent-service**: Agent registration, heartbeat, capabilities, device status
- **campaign-service**: Campaign orchestration, attack definitions, templates
- **task-service**: Task queueing, agent assignment, progress tracking
- **resource-service**: Hash lists, wordlists, rulelists, masklists, uploads
- **hash-service**: Hash type guessing, validation, hashcat mode mapping
- **event-service**: Real-time event streams via WebSockets/SSE

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

- Token-based authentication
- Defined by OpenAPI specification
- Endpoints: sessions, heartbeat, tasks/next, tasks/:id/report

### Web API (`/api/v1/web/*`)

- Session-based authentication
- RESTful JSON endpoints
- Supports all UI operations

### Control API (`/api/v1/control/*`)

- Automation-friendly endpoints
- Idempotent operations where possible
- Designed for n8n, MCP, and scripting

## Frontend Structure

- **App Router**: Server components for initial data loading
- **Client Components**: Interactive UI with React Query
- **Layouts**: Shared layouts with navigation and project context
- **Forms**: React Hook Form + Zod validation
- **Real-time**: EventContext provider for SSE/WebSocket subscriptions

## Testing Organization

- **Backend Unit Tests**: Service logic and utilities
- **Backend Integration Tests**: Full API tests with Testcontainers
- **Frontend Component Tests**: React Testing Library
- **E2E Tests**: Playwright covering major user journeys

## Configuration

- Environment-specific `.env` files
- Centralized config module with validation
- 12-factor app principles
- Separate configs for development, test, production

## Naming Conventions

- **Files**: kebab-case (e.g., `agent-service.ts`)
- **Components**: PascalCase (e.g., `AgentList.tsx`)
- **Functions**: camelCase (e.g., `createCampaign`)
- **Types/Interfaces**: PascalCase (e.g., `AgentStatus`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`)
- **MongoDB Collections**: snake_case (e.g., `hash_lists`)
