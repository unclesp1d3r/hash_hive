# HashHive justfile - Common development commands

# Show available recipes
default:
    @just --list

# Install all dependencies
install:
    npm install

# Complete setup (install deps, copy env files, start docker)
setup:
    ./scripts/setup.sh

# Validate project setup
validate:
    ./scripts/validate-setup.sh

# Start development servers (backend + frontend)
dev:
    npm run dev

# Start backend only
dev-backend:
    npm run dev -w backend

# Start frontend only
dev-frontend:
    npm run dev -w frontend

# Build all packages
build:
    npm run build

# Build specific package
build-backend:
    npm run build -w backend

build-frontend:
    npm run build -w frontend

build-shared:
    npm run build -w shared

# Run all tests
test:
    npm test

# Run backend tests
test-backend:
    npm run test -w backend

# Run frontend tests
test-frontend:
    npm run test -w frontend

# Run integration tests
test-integration:
    npm run test:integration -w backend

# Run E2E tests
test-e2e:
    npm run test:e2e -w frontend

# Run tests in watch mode
test-watch:
    npm run test:watch -w backend

# Lint all code
lint:
    npm run lint

# Format all code
format:
    npm run format

# Check code formatting
format-check:
    npm run format:check

# Run TypeScript type checking across all workspaces
type-check:
    npm run type-check --workspaces

# Start Docker services
docker-up:
    docker compose up -d

# Stop Docker services
docker-down:
    docker compose down

# View Docker logs
docker-logs:
    docker compose logs -f

# View logs for specific service
docker-logs-service service:
    docker compose logs -f {{service}}

# Reset Docker volumes and restart
docker-reset:
    docker compose down -v
    docker compose up -d

# Check Docker service status
docker-status:
    docker compose ps

# Clean build artifacts and dependencies
clean:
    rm -rf node_modules
    rm -rf backend/node_modules backend/dist
    rm -rf frontend/node_modules frontend/.next
    rm -rf shared/node_modules shared/dist
    rm -rf coverage

# Clean Docker volumes
clean-docker:
    docker compose down -v

# Full clean (code + docker)
clean-all: clean clean-docker

# Copy environment files from examples
env-setup:
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env

# Run backend in production mode
start-backend:
    npm run start -w backend

# Run frontend in production mode
start-frontend:
    npm run start -w frontend

# Generate coverage report
coverage:
    npm run test:coverage -w backend

# Open MinIO console
minio-console:
    open http://localhost:9001

# Connect to MongoDB shell
mongo-shell:
    docker compose exec mongodb mongosh hashhive

# Connect to Redis CLI
redis-cli:
    docker compose exec redis redis-cli

# Show environment info
info:
    @echo "Node version: $(node -v)"
    @echo "npm version: $(npm -v)"
    @echo "Docker version: $(docker --version)"
    @echo ""
    @echo "Services:"
    @docker compose ps

# Restart a specific service
restart service:
    docker compose restart {{service}}

ci-check: lint format-check type-check test coverage
