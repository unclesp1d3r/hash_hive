# Contributing to HashHive

## Development Setup

### Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- Git

### Initial Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd hashhive
```

2. **Run the setup script**

```bash
./scripts/setup.sh
```

Or manually:

```bash
# Install dependencies
npm install

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start infrastructure services
docker compose up -d
```

3. **Start development servers**

```bash
npm run dev
```

This starts both backend (port 3001) and frontend (port 3000) in watch mode.

## Project Structure

```
hashhive/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Configuration management
│   │   ├── models/       # Mongoose models
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   └── utils/        # Utilities
│   └── tests/            # Backend tests
├── frontend/             # Next.js + React UI
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   └── lib/              # Frontend utilities
├── shared/               # Shared TypeScript types
│   └── src/types/        # Common type definitions
└── openapi/              # API specifications
```

## Development Workflow

### Running Services

Use `just` commands for convenience:

```bash
# Start all services
just dev

# Start backend only
just dev-backend

# Start frontend only
just dev-frontend

# Start infrastructure (MongoDB, Redis, MinIO)
just docker-up
```

Or use npm directly:

```bash
npm run dev              # All services
npm run dev -w backend   # Backend only
npm run dev -w frontend  # Frontend only
docker compose up -d     # Infrastructure
```

### Code Quality

```bash
# Using just
just lint                # Lint all code
just format              # Format code
just format-check        # Check formatting
just type-check          # Type check

# Or npm directly
npm run lint
npm run format
npm run format:check
npm run type-check
```

### Testing

```bash
# Using just
just test                # Run all tests
just test-backend        # Backend unit tests
just test-integration    # Backend integration tests
just test-frontend       # Frontend tests
just test-e2e            # E2E tests
just test-watch          # Watch mode

# Or npm directly
npm test
npm run test -w backend
npm run test:integration -w backend
npm run test -w frontend
npm run test:e2e -w frontend
npm run test:watch -w backend
```

### Building

```bash
# Using just
just build               # Build all packages
just build-backend       # Build backend
just build-frontend      # Build frontend
just build-shared        # Build shared

# Or npm directly
npm run build
npm run build -w backend
npm run build -w frontend
npm run build -w shared
```

## NX Monorepo Tooling

HashHive uses [NX](https://nx.dev) for intelligent caching, affected detection, and task orchestration to dramatically improve developer productivity. NX automatically determines which projects need to be rebuilt, tested, or linted based on your changes, and caches results to make repeated runs nearly instantaneous.

### Understanding Affected Detection

NX's "affected detection" identifies only the projects that have changed compared to a base branch (typically `main`). This means you can run tests, builds, and linting only for what actually changed, saving significant time during development.

**See which projects are affected:**

```bash
# Using just
just affected-projects

# Or npm directly
npx nx show projects --affected --base=origin/main
```

**When to use affected vs. all:**

- **Use affected commands** (`just affected-test`, `just affected-build`) during feature development for fast feedback
- **Use all commands** (`just test`, `just build`) before committing to ensure everything passes

**Examples:**

- Changing `shared/src/types/index.ts` affects all projects (backend, frontend, shared) because both backend and frontend depend on shared
- Changing `backend/src/routes/auth.routes.ts` affects only backend
- Changing `frontend/app/page.tsx` affects only frontend

### Leveraging Caching

NX caches build, test, and lint outputs based on input files. If you run the same command twice without changing any source files, the second run will use cached results and complete almost instantly.

**Verify caching behavior:**

```bash
# First run (cache miss - actual execution)
just build-backend
# Output: Builds backend, takes ~5-10 seconds

# Second run (cache hit - instant)
just build-backend
# Output: [existing outputs match the cache, left as is] - completes in <1 second
```

**Cache location:** `.nx/cache/` (gitignored, local to your machine)

**Cache invalidation:** Automatic when source files change. NX compares file hashes to determine if inputs have changed.

### Affected Commands for Fast Iteration

Use affected commands during development to get fast feedback on your changes:

```bash
# See what changed
just affected-projects

# Run affected tests (much faster than all tests)
just affected-test
# or
npm run affected:test

# Run affected builds
just affected-build
# or
npm run affected:build

# Preview what CI would run
just affected-ci-preview
```

**Time savings example:**

- Running all tests: ~2 minutes
- Running affected tests (only backend changed): ~10 seconds

This workflow is especially valuable when iterating on a feature in a single project.

### Visualizing Dependencies

NX can generate a visual dependency graph showing how projects depend on each other:

```bash
# Open dependency graph in browser
just graph
# or
npm run graph
```

**What the graph shows:**

- Project dependencies (e.g., backend and frontend both depend on shared)
- Task dependencies (e.g., build tasks depend on upstream builds)
- Affected projects highlighted when comparing to a base branch

**Use cases:**

- Understanding the impact of changes before making them
- Debugging dependency issues
- Planning architectural changes

### Simulating CI Locally

Before creating a pull request, simulate what CI will run to catch failures early:

```bash
# See what CI would run for your changes
just affected-ci-preview

# Run affected targets (simulates PR CI)
just ci-affected

# Check if backend is affected (useful for conditional logic)
just affected-backend-check
```

**Benefits:**

- Catch CI failures before pushing
- Understand which projects will be tested in CI
- Verify affected detection is working correctly

The CI workflow uses affected detection for pull requests, so running `just ci-affected` locally closely simulates what will happen in CI.

### Troubleshooting NX

**Cache issues:**

If builds seem stale or tests fail unexpectedly, clear the cache:

```bash
just reset-cache
# or
npm run reset
```

**Task not running:**

- Verify the task exists in the project's `project.json` file
- Check that the task name matches exactly (e.g., `test:integration` not `test-integration`)

**Affected detection seems wrong:**

- Ensure you're comparing against the correct base branch (`origin/main`)
- Verify your changes are actually in the projects you expect
- Use `just affected-projects` to see what NX detected

**Performance:**

- NX runs tasks in parallel (default: 3 jobs)
- Adjust parallelism in `nx.json` if needed
- Cache hits are always fast regardless of parallelism

For detailed troubleshooting and advanced configuration, see [`docs/NX_SETUP.md`](docs/NX_SETUP.md).

### Best Practices

1. **During development:** Use affected commands (`just affected-test`, `just affected-build`) for fast feedback
2. **Before committing:** Run full `just ci-check` to ensure everything passes
3. **Cache issues:** Clear cache (`just reset-cache`) if you suspect cache corruption
4. **Architectural changes:** Use `just graph` to understand project dependencies before making changes
5. **Impact analysis:** Check affected projects (`just affected-projects`) to understand the scope of your changes

### Additional Resources

- **[`docs/NX_SETUP.md`](docs/NX_SETUP.md)**: Comprehensive NX documentation including CI/CD integration, advanced configuration, and detailed examples
- **[`README.md`](README.md#nx-monorepo-tooling)**: Quick reference for NX commands and features
- **[NX Official Docs](https://nx.dev)**: Complete NX documentation and guides

## Coding Standards

### TypeScript

- Use strict mode (enabled by default)
- Avoid `any` types
- Use explicit return types for public APIs
- Leverage type inference for internal code

### Code Style

- Follow ESLint rules
- Use Prettier for formatting
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in ES5

### Naming Conventions

- **Files**: kebab-case (`agent-service.ts`)
- **Components**: PascalCase (`AgentList.tsx`)
- **Functions**: camelCase (`createCampaign`)
- **Types/Interfaces**: PascalCase (`AgentStatus`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)

### Git Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linting
4. Commit with descriptive messages
5. Push and create a pull request

### Git Hooks

The project uses [pre-commit](https://pre-commit.com) for automated quality checks:

**Pre-commit Hook:**

- Automatically runs on `git commit`
- Formats staged files with Prettier
- Runs TypeScript type checking
- Ensures consistent code style

**Pre-push Hook:**

- Automatically runs on `git push`
- Runs TypeScript type checking across all workspaces
- Runs all test suites
- Prevents pushing broken code

**Installation:**

```bash
# Install pre-commit (requires Python)
pip install pre-commit

# Install hooks
pre-commit install
just install-hooks  # Or use the justfile command
```

The setup script (`./scripts/setup.sh`) will automatically install hooks if pre-commit is available.

**Updating Hooks:**

```bash
pre-commit autoupdate
# Or via justfile
just update-deps
```

To skip hooks in emergencies (not recommended):

```bash
git commit --no-verify
git push --no-verify
```

### Commit Messages

Follow conventional commits:

```markdown
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

- Use Testcontainers for real services
- Test API endpoints end-to-end
- Verify database operations
- Test queue operations

### E2E Tests

- Test critical user workflows
- Use Playwright for browser automation
- Test real-time features
- Verify authentication flows

## Documentation

- Document public APIs with JSDoc
- Update README for major changes
- Keep OpenAPI specs in sync with code
- Add inline comments for complex logic

## Infrastructure Services

### MongoDB

- Connection: `mongodb://localhost:27017/hashhive`
- GUI: Use MongoDB Compass or mongosh

### Redis

- Connection: `localhost:6379`
- GUI: Use RedisInsight or redis-cli

### MinIO

- API: <http://localhost:9000>
- Console: <http://localhost:9001>
- Credentials: minioadmin/minioadmin

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Stop existing services
docker compose down

# Change ports in docker-compose.yml
# Update .env files accordingly
```

### Database Issues

```bash
# Reset MongoDB
docker compose down -v
docker compose up -d mongodb

# View logs
docker compose logs mongodb
```

### Dependency Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
rm -rf backend/node_modules frontend/node_modules shared/node_modules
npm install
```

## Getting Help

- Check existing documentation in `docs/`
- Review OpenAPI specifications in `openapi/`
- Ask questions in pull requests
- Review implementation plans in `.kiro/specs/`
