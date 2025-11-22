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
