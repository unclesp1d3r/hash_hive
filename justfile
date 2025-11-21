# HashHive justfile - Common development commands

# Show available recipes
default:
    @just --list

# -----------------------------
# 🔧 Setup & Installation
# -----------------------------

# Update uv and pnpm dependencies
[unix]
update-deps:
    cd {{justfile_dir()}}
    npm update --all --include=dev
    pre-commit autoupdate

[windows]
update-deps:
    cd {{justfile_dir()}}
    npm update --all --include=dev
    pre-commit autoupdate

# Install all dependencies
install:
    npm install

# Complete setup (install deps, copy env files, start docker)
setup:
    ./scripts/setup.sh

# Validate project setup
validate:
    ./scripts/validate-setup.sh

# Copy environment files from examples
env-setup:
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env

# Install pre-commit hooks
install-hooks:
    pre-commit install
    bash scripts/install-git-hooks.sh

# -----------------------------
# 🚀 Development Environment
# -----------------------------

# Start development servers (backend + frontend)
dev:
    npm run dev

# Start backend only
dev-backend:
    npm run dev -w backend

# Start frontend only
dev-frontend:
    npm run dev -w frontend

# Run backend in production mode
start-backend:
    npm run start -w backend

# Run frontend in production mode
start-frontend:
    npm run start -w frontend

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

# -----------------------------
# 🧹 Linting, Typing, Dep Check
# -----------------------------

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

# -----------------------------
# 🧪 Testing & Coverage
# -----------------------------

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

# Generate coverage report
coverage:
    npm run test:coverage -w backend

# -----------------------------
# 📦 Build & Clean
# -----------------------------

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

# -----------------------------
# 🐳 Docker & Infrastructure
# -----------------------------

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

# Open MinIO console
minio-console:
    open http://localhost:9001

# -----------------------------
# 🗄️ Database Tasks
# -----------------------------

# Connect to MongoDB shell
mongo-shell:
    docker compose exec mongodb mongosh hashhive

# Connect to Redis CLI
redis-cli:
    docker compose exec redis redis-cli

# -----------------------------
# 🤖 CI Workflow
# -----------------------------

# Run the full CI check locally or in GitHub Actions.
# This relies on Jest + Testcontainers to provision MongoDB, Redis, and MinIO
# for the backend test suites, so no docker-compose step is required.
ci-check:
    @just lint
    @just format-check
    @just type-check
    @just test-backend
    @just test-integration
    @just coverage

# -----------------------------
# 📚 Documentation
# -----------------------------

# -----------------------------
# 🚢 Production Build & Deployment
# -----------------------------
