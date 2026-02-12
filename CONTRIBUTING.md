# Contributing to HashHive

## Development Setup

### Prerequisites

- Bun 1.2+ (runtime, package manager, and test runner)
- Docker and Docker Compose
- Git
- [just](https://github.com/casey/just) (optional, for convenience commands)

### Initial Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd hashhive
```

2. **Run the setup command**

```bash
just setup
```

Or manually:

```bash
# Install dependencies
bun install

# Copy environment files
cp packages/backend/.env.example packages/backend/.env

# Start infrastructure services (PostgreSQL, Redis, MinIO)
docker compose up -d
```

3. **Start development servers**

```bash
bun dev
```

This starts both backend and frontend in watch mode via Turborepo.

## Project Structure

```
hashhive/
├── packages/
│   ├── backend/          # Bun + Hono API
│   │   ├── src/
│   │   │   ├── config/       # Configuration management
│   │   │   ├── db/           # Drizzle client setup
│   │   │   ├── routes/       # Hono route handlers by domain
│   │   │   ├── services/     # Business logic (optional)
│   │   │   ├── middleware/   # Hono middleware
│   │   │   └── queue/        # BullMQ workers and queue config
│   │   └── tests/            # Backend tests
│   ├── frontend/         # React 19 + Vite UI
│   │   ├── src/
│   │   │   ├── components/   # React components (ui/ + features/)
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── hooks/        # TanStack Query wrappers
│   │   │   ├── stores/       # Zustand stores
│   │   │   └── lib/          # Utilities and API client
│   │   └── tests/            # Frontend tests
│   ├── shared/           # Drizzle schema, Zod schemas, types
│   │   └── src/
│   │       ├── db/           # Schema + migrations
│   │       ├── schemas/      # Zod schemas (drizzle-zod + custom)
│   │       └── types/        # Inferred types (z.infer exports)
│   └── openapi/          # API specifications
└── turbo.json            # Turborepo configuration
```

## Development Workflow

### Running Services

Use `just` commands for convenience:

```bash
just dev              # Start all services
just dev-backend      # Start backend only
just dev-frontend     # Start frontend only
just docker-up        # Start infrastructure (PostgreSQL, Redis, MinIO)
```

Or use bun directly:

```bash
bun dev                      # All services
bun --filter backend dev     # Backend only
bun --filter frontend dev    # Frontend only
docker compose up -d         # Infrastructure
```

### Code Quality

```bash
just lint                # Lint all code (Biome)
just format              # Format code (Biome)
just format-check        # Check formatting
just type-check          # TypeScript type check
```

### Testing

```bash
just test                # Run all tests (bun:test)
just test-backend        # Backend tests
just test-frontend       # Frontend tests
just test-e2e            # E2E tests (Playwright)
```

### Building

```bash
just build               # Build all packages (Turborepo cached)
just build-backend       # Build backend
just build-frontend      # Build frontend
just build-shared        # Build shared
```

### Full CI Check

```bash
just ci-check            # lint + format-check + type-check + build + test
```

## Coding Standards

### TypeScript

- Strict mode enabled (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.)
- Avoid `any` types
- Use explicit return types for public APIs
- Leverage type inference for internal code

### Code Style

- **Biome** for linting and formatting (not ESLint, not Prettier)
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas

### Naming Conventions

- **Files**: kebab-case (`agent-service.ts`)
- **Components**: PascalCase (`AgentList.tsx`)
- **Functions**: camelCase (`createCampaign`)
- **Types/Interfaces**: PascalCase (`AgentStatus`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)

### Git Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `just ci-check`
4. Commit with descriptive messages
5. Push and create a pull request

### Git Hooks

The project uses [pre-commit](https://pre-commit.com) for automated quality checks:

- Biome format and lint checks
- TypeScript type checking
- Trailing whitespace and file hygiene

```bash
pip install pre-commit
pre-commit install
```

### Commit Messages

Follow conventional commits:

```
feat: add agent heartbeat endpoint
fix: resolve task assignment race condition
docs: update API documentation
test: add campaign service tests
refactor: simplify task distribution logic
```

## Testing Guidelines

### Unit Tests

- Test business logic in isolation
- Mock external dependencies
- Focus on edge cases and error handling
- Aim for 80%+ coverage

### Integration Tests

- Test API endpoints with a test database
- Verify database operations
- Test queue operations

### E2E Tests

- Test critical user workflows
- Use Playwright for browser automation
- Test real-time features
- Verify authentication flows

## Infrastructure Services

### PostgreSQL

- Connection: `localhost:5432`
- Database: `hashhive`
- GUI: Use Drizzle Studio (`just db-studio`) or psql (`just psql-shell`)

### Redis

- Connection: `localhost:6379`
- GUI: Use RedisInsight or redis-cli (`just redis-cli`)

### MinIO

- API: <http://localhost:9000>
- Console: <http://localhost:9001>
- Credentials: minioadmin/minioadmin

## Troubleshooting

### Port Conflicts

```bash
docker compose down
# Change ports in docker-compose.yml and update .env files
```

### Database Issues

```bash
# Reset PostgreSQL
docker compose down -v
docker compose up -d

# Run migrations
just db-migrate

# View logs
docker compose logs postgres
```

### Dependency Issues

```bash
just clean       # Remove all node_modules and build artifacts
bun install      # Fresh install
```

## Getting Help

- Check documentation in `docs/`
- Review OpenAPI specifications in `packages/openapi/`
- Review architecture in `.kiro/steering/`
- Ask questions in pull requests
