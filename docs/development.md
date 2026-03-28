# Development Setup

## Prerequisites

- **Bun 1.2+** -- runtime, package manager, and test runner
- **Docker and Docker Compose** -- infrastructure services
- **Git**
- **[just](https://github.com/casey/just)** -- task runner (optional but recommended)

## Initial Setup

```bash
git clone <repository-url>
cd hashhive
bun install
cp packages/backend/.env.example packages/backend/.env
docker compose up -d     # PostgreSQL, Redis, MinIO
bun dev                  # Start all services via Turborepo
```

Or use `just setup` to run the above in one step.

## Monorepo Structure

Turborepo with Bun workspaces. Three packages:

| Package | Name | Description |
|---------|------|-------------|
| `packages/backend` | `@hashhive/backend` | Bun + Hono API |
| `packages/frontend` | `@hashhive/frontend` | React 19 + Vite UI |
| `packages/shared` | `@hashhive/shared` | Drizzle schema, Zod schemas, TypeScript types |

Workspace filters use the full package.json name:

```bash
bun --filter @hashhive/backend dev     # Not `bun --filter backend dev`
```

## Commands

### Development

```bash
bun dev                          # Start all services via Turborepo
bun --filter @hashhive/backend dev   # Backend only
bun --filter @hashhive/frontend dev  # Frontend only
```

### Code Quality

```bash
bun lint                         # Lint all code with Biome
bun format                       # Format all code with Biome
bun type-check                   # TypeScript type checking
```

### Building

```bash
bun build                        # Build all packages via Turborepo
```

### Database

```bash
bun --filter @hashhive/backend db:generate   # Generate Drizzle migrations
bun --filter @hashhive/backend db:migrate    # Run migrations
bun --filter @hashhive/backend db:push       # Push schema (dev only)
bun --filter @hashhive/backend db:studio     # Open Drizzle Studio
bun --filter @hashhive/backend db:seed       # Seed admin user (admin@hashhive.local / changeme123)
```

### Local CI Check

```bash
just ci-check    # lint -> format-check -> type-check -> build -> test
```

Run this before pushing. It matches what CI runs.

## Infrastructure Services

| Service | Port | Credentials | GUI |
|---------|------|-------------|-----|
| PostgreSQL | 5432 | hashhive/hashhive | Drizzle Studio (`just db-studio`) or psql |
| Redis | 6379 | -- | RedisInsight or `redis-cli` |
| MinIO (API) | 9000 | minioadmin/minioadmin | -- |
| MinIO (Console) | 9001 | minioadmin/minioadmin | <http://localhost:9001> |

## Environment Variables

Copy `packages/backend/.env.example` to `packages/backend/.env`. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://hashhive:hashhive@localhost:5432/hashhive` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `S3_ENDPOINT` | MinIO endpoint | `http://localhost:9000` |
| `BETTER_AUTH_SECRET` | Session signing secret (min 32 chars) | -- |
| `PORT` | Backend port | `4000` |
| `NODE_ENV` | Environment | `development` |

Generate `BETTER_AUTH_SECRET` with: `openssl rand -base64 32`

## Troubleshooting

**Port conflicts:** `docker compose down`, change ports in `docker-compose.yml` and `.env`.

**Database reset:** `docker compose down -v && docker compose up -d && just db-migrate`

**Dependency issues:** `just clean && bun install`

**Build fails after schema change:** Delete `**/tsconfig.tsbuildinfo` and rebuild.
