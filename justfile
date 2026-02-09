# HashHive justfile - Common development commands

set windows-shell := ["powershell.exe", "-c"]
set shell := ["bash", "-c"]
set dotenv-load := true

# Show available recipes
default:
    @just --choose

# -----------------------------
# Setup & Installation
# -----------------------------

# Update dependencies
[unix]
update-deps:
    cd {{ justfile_dir() }}
    bun update
    pre-commit autoupdate

[windows]
update-deps:
    cd {{ justfile_dir() }}
    bun update
    pre-commit autoupdate

# Install all dependencies
install:
    bun install

# Complete setup (install deps, copy env files, start docker)
[unix]
setup:
    #!/usr/bin/env bash
    # HashHive Setup - Unix
    # Check Bun version (require 1.2+)
    BUN_VERSION=$(bun --version)
    BUN_MAJOR=$(echo "$BUN_VERSION" | cut -d'.' -f1)
    BUN_MINOR=$(echo "$BUN_VERSION" | cut -d'.' -f2)
    if [ "$BUN_MAJOR" -lt 1 ] || { [ "$BUN_MAJOR" -eq 1 ] && [ "$BUN_MINOR" -lt 2 ]; }; then
        echo "Bun 1.2+ is required. Current version: $BUN_VERSION" >&2
        exit 1
    fi

    # Node.js is still required for Next.js
    NODE_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
        echo "Node.js 20+ is required for Next.js. Current version: $(node -v)" >&2
        exit 1
    fi

    bun install

    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
    fi

    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
    fi

    docker compose up -d
    sleep 5
    docker compose ps

    if command -v pre-commit >/dev/null 2>&1; then
        pre-commit install
    fi

    bash scripts/install-git-hooks.sh

    echo "Setup complete."

[windows]
setup:
    #!pwsh.exe
    # HashHive Setup - Windows (PowerShell)
    $bunVersionOutput = bun --version
    if (-not $bunVersionOutput) {
      Write-Error "Bun is not installed or not on PATH. Please install Bun 1.2+ first."
      exit 1
    }
    $bunParts = $bunVersionOutput.Split('.')
    $bunMajor = [int]$bunParts[0]
    $bunMinor = [int]$bunParts[1]
    if ($bunMajor -lt 1 -or ($bunMajor -eq 1 -and $bunMinor -lt 2)) {
      Write-Error "Bun 1.2+ is required. Current version: $bunVersionOutput"
      exit 1
    }

    $nodeVersionOutput = node -v
    if (-not $nodeVersionOutput) {
      Write-Error "Node.js is not installed or not on PATH. Please install Node.js 20+ first (required for Next.js)."
      exit 1
    }

    $nodeMajorVersion = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
    if ($nodeMajorVersion -lt 20) {
      Write-Error "Node.js 20+ is required for Next.js. Current version: $nodeVersionOutput"
      exit 1
    }

    bun install

    if (-not (Test-Path "backend/.env")) {
      Copy-Item "backend/.env.example" "backend/.env"
    }

    if (-not (Test-Path "frontend/.env")) {
      Copy-Item "frontend/.env.example" "frontend/.env"
    }

    docker compose up -d
    Start-Sleep -Seconds 5
    docker compose ps

    if (Get-Command pre-commit -ErrorAction SilentlyContinue) {
      pre-commit install
    }

    # Install Git hooks (requires bash - available via Git Bash, WSL, or similar)
    if (Get-Command bash -ErrorAction SilentlyContinue) {
      bash scripts/install-git-hooks.sh
    } else {
      Write-Warning "bash not found - skipping Git hooks installation. Install Git Bash or WSL to enable."
    }

    Write-Output "Setup complete."

# Validate project setup
[unix]
validate:
    #!/usr/bin/env bash
    set -euo pipefail

    BUN_VERSION=$(bun --version)
    BUN_MAJOR=$(echo "$BUN_VERSION" | cut -d'.' -f1)
    BUN_MINOR=$(echo "$BUN_VERSION" | cut -d'.' -f2)
    if [ "$BUN_MAJOR" -lt 1 ] || { [ "$BUN_MAJOR" -eq 1 ] && [ "$BUN_MINOR" -lt 2 ]; }; then
        echo "Bun 1.2+ required. Current: $BUN_VERSION" >&2
        exit 1
    fi

    NODE_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
        echo "Node.js 20+ required for Next.js. Current: $(node -v)" >&2
        exit 1
    fi

    if ! command -v docker >/dev/null 2>&1; then
        echo "Docker not found" >&2
        exit 1
    fi

    if ! command -v docker compose >/dev/null 2>&1; then
        echo "Docker Compose not found" >&2
        exit 1
    fi

    for dir in backend frontend shared openapi; do
        if [ ! -d "$dir" ]; then
            echo "Missing directory: $dir" >&2
            exit 1
        fi
    done

    for pkg in package.json backend/package.json frontend/package.json shared/package.json; do
        if [ ! -f "$pkg" ]; then
            echo "Missing: $pkg" >&2
            exit 1
        fi
    done

    for tsconfig in tsconfig.base.json backend/tsconfig.json frontend/tsconfig.json shared/tsconfig.json; do
        if [ ! -f "$tsconfig" ]; then
            echo "Missing: $tsconfig" >&2
            exit 1
        fi
    done

    if [ ! -f backend/.env.example ]; then
        echo "Missing: backend/.env.example" >&2
        exit 1
    fi

    if [ ! -f frontend/.env.example ]; then
        echo "Missing: frontend/.env.example" >&2
        exit 1
    fi

    if [ ! -f docker-compose.yml ]; then
        echo "Missing: docker-compose.yml" >&2
        exit 1
    fi

    if [ ! -d node_modules ]; then
        echo "Dependencies not installed (run: bun install)" >&2
        exit 1
    fi

[windows]
validate:
    #!pwsh.exe
    # HashHive validation - Windows (PowerShell)
    $bunVersionOutput = bun --version
    if (-not $bunVersionOutput) {
        Write-Error "Bun is not installed or not on PATH."
        exit 1
    }
    $bunParts = $bunVersionOutput.Split('.')
    $bunMajor = [int]$bunParts[0]
    $bunMinor = [int]$bunParts[1]
    if ($bunMajor -lt 1 -or ($bunMajor -eq 1 -and $bunMinor -lt 2)) {
        Write-Error "Bun 1.2+ required. Current: $bunVersionOutput"
        exit 1
    }

    $nodeVersionOutput = node -v
    if (-not $nodeVersionOutput) {
        Write-Error "Node.js is not installed or not on PATH."
        exit 1
    }

    $nodeMajorVersion = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
    if ($nodeMajorVersion -lt 20) {
        Write-Error "Node.js 20+ required for Next.js. Current: $nodeVersionOutput"
        exit 1
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker not found"
        exit 1
    }

    if (-not (docker compose version 2>$null)) {
        Write-Error "Docker Compose not found"
        exit 1
    }

    $requiredDirs = @("backend", "frontend", "shared", "openapi")
    foreach ($dir in $requiredDirs) {
      if (-not (Test-Path $dir -PathType Container)) {
        Write-Error "Missing directory: $dir"
        exit 1
      }
    }

    $requiredPackages = @("package.json", "backend/package.json", "frontend/package.json", "shared/package.json")
    foreach ($pkg in $requiredPackages) {
        if (-not (Test-Path $pkg -PathType Leaf)) {
            Write-Error "Missing: $pkg"
            exit 1
        }
    }

    $requiredTsconfigs = @("tsconfig.base.json", "backend/tsconfig.json", "frontend/tsconfig.json", "shared/tsconfig.json")
    foreach ($tsconfig in $requiredTsconfigs) {
        if (-not (Test-Path $tsconfig -PathType Leaf)) {
            Write-Error "Missing: $tsconfig"
            exit 1
        }
    }

    if (-not (Test-Path "backend/.env.example" -PathType Leaf)) {
        Write-Error "Missing: backend/.env.example"
        exit 1
    }

    if (-not (Test-Path "frontend/.env.example" -PathType Leaf)) {
        Write-Error "Missing: frontend/.env.example"
        exit 1
    }

    if (-not (Test-Path "docker-compose.yml" -PathType Leaf)) {
        Write-Error "Missing: docker-compose.yml"
        exit 1
    }

    if (-not (Test-Path "node_modules" -PathType Container)) {
        Write-Warning "Dependencies not installed (run: bun install)"
        exit 1
    }

# Copy environment files from examples
env-setup:
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env

# Install pre-commit hooks
[unix]
install-hooks:
    #!/usr/bin/env bash
    pre-commit install
    if [ -f scripts/install-git-hooks.sh ]; then
        bash scripts/install-git-hooks.sh
    else
        echo "Note: scripts/install-git-hooks.sh not found - skipping additional hooks"
    fi

[windows]
install-hooks:
    #!pwsh.exe
    pre-commit install
    if (Test-Path "scripts/install-git-hooks.sh") {
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            bash scripts/install-git-hooks.sh
        } else {
            Write-Warning "bash not found - skipping Git hooks installation. Install Git Bash or WSL to enable."
        }
    } else {
        Write-Output "Note: scripts/install-git-hooks.sh not found - skipping additional hooks"
    }

# -----------------------------
# Development Environment
# -----------------------------

# Start development servers (backend + frontend)
dev:
    bun run dev

# Start backend only
dev-backend:
    bun run --filter '@hashhive/backend' dev

# Start frontend only
dev-frontend:
    bun run --filter '@hashhive/frontend' dev

# Run backend in production mode
start-backend:
    bun run --filter '@hashhive/backend' start

# Run frontend in production mode
start-frontend:
    bun run --filter '@hashhive/frontend' start

# Show environment info
[unix]
info:
    @echo "Bun version: $(bun --version)"
    @echo "Node version: $(node -v)"
    @echo "Docker version: $(docker --version)"
    @echo ""
    @echo "Services:"
    @docker compose ps

[windows]
info:
    #!pwsh.exe
    Write-Output "Bun version: $(bun --version)"
    Write-Output "Node version: $(node -v)"
    Write-Output "Docker version: $(docker --version)"
    Write-Output ""
    Write-Output "Services:"
    docker compose ps

# Restart a specific service
restart service:
    docker compose restart {{ service }}

# -----------------------------
# Linting, Typing, Dep Check
# -----------------------------

# Lint all code (NX cached)
lint:
    bunx nx run-many --target=lint

# Format all code
format:
    bun run format

# Check code formatting
format-check:
    bun run format:check

# Run TypeScript type checking across all workspaces (NX cached)
type-check:
    bunx nx run-many --target=type-check

# -----------------------------
# Testing & Coverage
# -----------------------------

# Run all tests (NX cached)
test:
    bunx nx run-many --target=test

# Run backend tests
test-backend:
    bunx nx run @hashhive/backend:test

# Run frontend tests
test-frontend:
    bunx nx run @hashhive/frontend:test

# Run integration tests (not cached)
test-integration:
    bunx nx run @hashhive/backend:test:integration

# Run E2E tests (not cached)
test-e2e:
    bunx nx run @hashhive/frontend:test:e2e

# Run tests in watch mode
test-watch:
    bun run --filter '@hashhive/backend' test:watch

# Generate coverage report
coverage:
    bunx nx run @hashhive/backend:test:coverage

# -----------------------------
# Build & Clean
# -----------------------------

# Build all packages (NX cached, dependency-ordered)
build:
    bunx nx run-many --target=build

# Build specific package
build-backend:
    bunx nx run @hashhive/backend:build

build-frontend:
    bunx nx run @hashhive/frontend:build

build-shared:
    bunx nx run @hashhive/shared:build

# Clean build artifacts and dependencies
[unix]
clean:
    #!/usr/bin/env bash
    rm -rf node_modules
    rm -rf backend/node_modules backend/dist
    rm -rf frontend/node_modules frontend/.next
    rm -rf shared/node_modules shared/dist
    rm -rf coverage
    rm -rf .nx

[windows]
clean:
    #!pwsh.exe
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force backend/node_modules, backend/dist -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force frontend/node_modules, frontend/.next -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force shared/node_modules, shared/dist -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force coverage -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force .nx -ErrorAction SilentlyContinue

# Clean Docker volumes
clean-docker:
    docker compose down -v

# Full clean (code + docker)
clean-all: clean clean-docker

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

# Open MinIO console
[unix]
minio-console:
    #!/usr/bin/env bash
    URL="http://localhost:9001"
    if command -v open >/dev/null 2>&1; then
        open "$URL"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL"
    else
        echo "Error: No suitable command found to open URL. Install 'xdg-open' (Linux) or use 'open' (macOS)" >&2
        exit 1
    fi

[windows]
minio-console:
    #!pwsh.exe
    $url = "http://localhost:9001"
    try {
        Start-Process $url
    } catch {
        Write-Error "Failed to open URL: $url"
        exit 1
    }

# -----------------------------
# Database Tasks
# -----------------------------

# Connect to MongoDB shell
mongo-shell:
    docker compose exec mongodb mongosh hashhive

# Connect to Redis CLI
redis-cli:
    docker compose exec redis redis-cli

# -----------------------------
# CI Workflow
# -----------------------------
# Run the full CI check locally or in GitHub Actions.
# This relies on Jest + Testcontainers to provision MongoDB, Redis, and MinIO
# for the backend test suites, so no docker-compose step is required.
ci-check: lint format-check build-shared type-check test-backend test-integration test-frontend test-e2e coverage

# -----------------------------
# Documentation
# -----------------------------
# -----------------------------
# Production Build & Deployment
# -----------------------------
