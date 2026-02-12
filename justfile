# HashHive justfile - Common development commands

set shell := ["bash", "-c"]
set dotenv-load := true

# Show available recipes
default:
    @just --choose

# -----------------------------
# Setup & Installation
# -----------------------------

# Install all dependencies
install:
    bun install

# Complete setup (install deps, copy env files, start docker)
setup:
    #!/usr/bin/env bash
    BUN_VERSION=$(bun --version)
    BUN_MAJOR=$(echo "$BUN_VERSION" | cut -d'.' -f1)
    BUN_MINOR=$(echo "$BUN_VERSION" | cut -d'.' -f2)
    if [ "$BUN_MAJOR" -lt 1 ] || { [ "$BUN_MAJOR" -eq 1 ] && [ "$BUN_MINOR" -lt 2 ]; }; then
        echo "Bun 1.2+ is required. Current version: $BUN_VERSION" >&2
        exit 1
    fi

    bun install

    if [ ! -f packages/backend/.env ]; then
        cp packages/backend/.env.example packages/backend/.env
    fi

    docker compose up -d
    sleep 5
    docker compose ps

    if command -v pre-commit >/dev/null 2>&1; then
        pre-commit install
    fi

    echo "Setup complete."

# Copy environment files from examples
env-setup:
    cp packages/backend/.env.example packages/backend/.env

# Install pre-commit hooks
install-hooks:
    pre-commit install

# Update dependencies
update-deps:
    bun update
    pre-commit autoupdate

# -----------------------------
# Development Environment
# -----------------------------

# Start development servers (backend + frontend)
dev:
    bun run dev

# Start backend only
dev-backend:
    bun --filter backend dev

# Start frontend only
dev-frontend:
    bun --filter frontend dev

# Show environment info
info:
    @echo "Bun version: $(bun --version)"
    @echo "Docker version: $(docker --version 2>/dev/null || echo 'not installed')"
    @echo ""
    @docker compose ps 2>/dev/null || echo "Docker services not running"

# -----------------------------
# Linting, Typing, Formatting
# -----------------------------

# Lint all code
lint:
    bun run lint

# Format all code
format:
    bun run format

# Check code formatting
format-check:
    bun run format:check

# Run TypeScript type checking
type-check:
    bun run type-check

# -----------------------------
# Testing
# -----------------------------

# Run all tests
test:
    bun run test

# Run backend tests
test-backend:
    bun --filter backend test

# Run frontend tests
test-frontend:
    bun --filter frontend test

# Run E2E tests
test-e2e:
    bun run test:e2e

# -----------------------------
# Build & Clean
# -----------------------------

# Build all packages (Turborepo cached, dependency-ordered)
build:
    bun run build

# Build specific package
build-backend:
    bun --filter backend build

build-frontend:
    bun --filter frontend build

build-shared:
    bun --filter shared build

# Clean build artifacts and dependencies
clean:
    rm -rf node_modules
    rm -rf packages/backend/node_modules packages/backend/dist
    rm -rf packages/frontend/node_modules packages/frontend/dist
    rm -rf packages/shared/node_modules packages/shared/dist
    rm -rf .turbo packages/*/.turbo

# -----------------------------
# Docker & Infrastructure
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
    docker compose logs -f {{ service }}

# Reset Docker volumes and restart
docker-reset:
    docker compose down -v
    docker compose up -d

# Check Docker service status
docker-status:
    docker compose ps

# Clean Docker volumes
clean-docker:
    docker compose down -v

# Full clean (code + docker)
clean-all: clean clean-docker

# -----------------------------
# Database
# -----------------------------

# Connect to PostgreSQL shell
psql-shell:
    docker compose exec postgres psql -U hashhive hashhive

# Connect to Redis CLI
redis-cli:
    docker compose exec redis redis-cli

# Generate Drizzle migrations
db-generate:
    bun --filter backend db:generate

# Run Drizzle migrations
db-migrate:
    bun --filter backend db:migrate

# Open Drizzle Studio
db-studio:
    bun --filter backend db:studio

# -----------------------------
# CI Workflow
# -----------------------------

# Run the full CI check locally.
# Backend tests use bun:test with mocked services — no docker-compose required.
ci-check: lint format-check type-check build test
