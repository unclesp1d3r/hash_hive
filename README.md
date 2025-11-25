# HashHive

HashHive is a distributed password cracking platform that orchestrates hashcat across multiple agents in a LAN environment. Built with the MERN stack (MongoDB, Express, React, Node.js) and TypeScript throughout.

## Project Structure

```text
hashhive/
├── backend/          # Node.js + Express API server
├── frontend/         # Next.js + React web UI
├── shared/           # Shared TypeScript types
├── openapi/          # API specifications
└── docs/             # Documentation
```

## Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Git
- [just](https://github.com/casey/just) (optional, for convenient command running)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure Services

```bash
docker compose up -d
```

This starts:

- MongoDB on port 27017
- Redis on port 6379
- MinIO on ports 9000 (API) and 9001 (Console)

### 3. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

### 4. Start Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or start individually
npm run dev -w backend
npm run dev -w frontend
```

- Backend API: <http://localhost:3001>
- Frontend UI: <http://localhost:3000>
- MinIO Console: <http://localhost:9001> (minioadmin/minioadmin)

## Development

### Available Scripts

Use `just` for common commands (or run npm scripts directly):

```bash
# Development
just dev                 # Start all services
just dev-backend         # Start backend only
just dev-frontend        # Start frontend only

# Building (NX-powered)
just build               # Build all packages
just build-backend       # Build backend only
just build-frontend      # Build frontend only

# Testing (NX-powered)
just test                # Run all tests
just test-backend        # Backend tests
just test-frontend       # Frontend tests
just test-integration    # Integration tests
just test-e2e            # E2E tests

# Code Quality (NX-powered)
just lint                # Lint all packages
just format              # Format code with Prettier
just type-check          # TypeScript type checking

# Docker
just docker-up           # Start services
just docker-down         # Stop services
just docker-logs         # View logs

# Or use npm scripts directly
npm run dev              # Start all services
npm run build            # Build all packages (NX-powered)
npm run test             # Run all tests (NX-powered)
```

### Project Configuration

- **TypeScript**: Strict mode enabled with shared base config
- **ESLint**: Consistent rules across all packages
- **Prettier**: Automated code formatting (TypeScript, JavaScript, JSON, Markdown, YAML)
- **Jest**: Unit and integration testing
- **Playwright**: E2E testing for frontend
- **NX**: Monorepo tooling with intelligent caching and task orchestration

## NX Monorepo Tooling

HashHive uses [NX](https://nx.dev) for enhanced monorepo management, providing:

- **Intelligent Caching**: Build, test, and lint results are cached locally, dramatically speeding up repeated runs
- **Affected Detection**: Only run tasks for projects that changed since the last commit
- **Dependency Graph**: Visualize project dependencies with `nx graph`
- **Automatic Task Ordering**: NX automatically determines the correct execution order based on project dependencies
- **Parallel Execution**: Tasks run in parallel when possible (configurable parallelism)

### NX Commands

```bash
# Run affected tests (only changed projects)
just affected-test
# or
npm run affected:test

# Run affected builds
just affected-build
# or
npm run affected:build

# Visualize project graph
just graph
# or
npm run graph

# Reset NX cache
just reset-cache
# or
npm run reset
```

All standard commands (`build`, `test`, `lint`, `type-check`) are now NX-powered and benefit from caching and dependency-aware execution. The `just` recipes and npm scripts have been updated to use NX under the hood.

### Advanced Features

HashHive uses advanced NX features for optimal performance:

- **Fine-grained cache invalidation** based on dependencies, configuration, and source files
- **Intelligent task pipeline** with automatic dependency ordering
- **Configurable parallel execution** (default: 3, CI: 5)
- **Retry logic** for flaky integration and E2E tests
- **Docker build caching** with BuildKit support

See [docs/NX_SETUP.md](docs/NX_SETUP.md#advanced-features) for detailed documentation.

> **Performance Tips**
> - Use `just affected-test` instead of `just test` when working on a specific feature
> - Run `just benchmark-cache` to verify cache is working correctly
> - Increase parallelism on powerful machines: `just test-parallel 8`
> - See `just cache-stats` to monitor cache size and effectiveness

### CI/CD Integration

[![CI](https://github.com/unclesp1d3r/hash_hive/workflows/CI/badge.svg)](https://github.com/unclesp1d3r/hash_hive/actions/workflows/ci.yml)

The CI/CD pipeline leverages NX for intelligent task orchestration:

- **Affected Detection for PRs**: Only runs tests for projects that changed, saving significant time
- **Conditional Execution**: Skips Docker pulls and integration tests when backend is unaffected
- **Smart Caching**: Uses both NX cache and GitHub Actions cache for faster runs

**Example:**
```bash
# See what would run in CI for your changes
just affected-ci-preview

# Run affected tests locally (simulates PR CI)
just ci-affected

# Check if backend is affected
just affected-backend-check
```

For detailed CI/CD documentation, see [docs/NX_SETUP.md](docs/NX_SETUP.md#cicd-integration).

### Validation

After setting up the project or making major changes, run through the [validation checklist](docs/NX_VALIDATION_CHECKLIST.md) to ensure all NX features are working correctly. The checklist provides step-by-step instructions for verifying dependency graphs, caching, affected detection, and more.

**Quick validation commands:**
```bash
# Run full CI check
just ci-check

# Benchmark cache performance
just benchmark-cache

# Check affected projects
just affected-projects

# Visualize dependency graph
just graph
```

For comprehensive validation instructions, see [docs/NX_VALIDATION_CHECKLIST.md](docs/NX_VALIDATION_CHECKLIST.md). For optimization best practices and advanced configuration, see [docs/NX_OPTIMIZATION_GUIDE.md](docs/NX_OPTIMIZATION_GUIDE.md).

## Architecture

HashHive follows a monorepo structure with:

- **Backend**: Express API with Mongoose ODM, BullMQ for queues, Pino for logging
- **Frontend**: Next.js with App Router, shadcn/ui components, React Query for data fetching
- **Shared**: Common TypeScript types and Zod schemas

## Infrastructure Services

### MongoDB

- Primary database for all application data
- Mongoose ODM with TypeScript support
- Health checks and automatic reconnection

### Redis

- BullMQ job queues for task distribution
- Session storage
- Caching layer

### MinIO

- S3-compatible object storage
- Stores hash lists, wordlists, and other binary artifacts
- Development alternative to AWS S3

## Testing

```bash
# Run all tests
npm test

# Run affected tests (only changed projects - what CI does for PRs)
just affected-test
# or
npm run affected:test

# Backend unit tests
npm run test -w backend

# Backend integration tests (requires Docker)
npm run test:integration -w backend

# Frontend component tests
npm run test -w frontend

# E2E tests
npm run test:e2e -w frontend
```

**CI Integration**: The CI workflow uses NX affected detection to only run tests for changed projects in pull requests. See `just affected-ci-preview` to preview what would run in CI, or `just ci-affected` to simulate PR CI behavior locally.

## Documentation

See the `docs/` directory for:

- MERN migration proposal
- Implementation plans
- Architecture decisions
- API specifications

## License

This is a test/development project based on the CipherSwarm architecture, and is relicensed under the Apache-2.0 license.
