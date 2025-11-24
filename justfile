# HashHive justfile - Common development commands

set windows-shell := ["powershell.exe", "-c"]
set shell := ["bash", "-c"]
set dotenv-load := true

# Show available recipes
default:
    @just --choose

# -----------------------------
# 🔧 Setup & Installation
# -----------------------------

# Update uv and pnpm dependencies
[unix]
update-deps:
    cd {{ justfile_dir() }}
    npm update --all --include=dev
    pre-commit autoupdate

[windows]
update-deps:
    cd {{ justfile_dir() }}
    npm update --all --include=dev
    pre-commit autoupdate

# Install all dependencies
install:
    npm install

# Complete setup (install deps, copy env files, start docker)
[unix]
setup:
    #!/usr/bin/env bash
    # HashHive Setup - Unix
    # Check Node.js major version (require 20+)
    NODE_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
        echo "Node.js 20+ is required. Current version: $(node -v)" >&2
        exit 1
    fi

    npm install
    npm install --workspaces

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
    $nodeVersionOutput = node -v
    if (-not $nodeVersionOutput) {
      Write-Error "Node.js is not installed or not on PATH. Please install Node.js 20+ first."
      exit 1
    }

    $nodeMajorVersion = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
    if ($nodeMajorVersion -lt 20) {
      Write-Error "Node.js 20+ is required. Current version: $nodeVersionOutput"
      exit 1
    }

    npm install
    npm install --workspaces

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

    NODE_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
        echo "Node.js 20+ required. Current: $(node -v)" >&2
        exit 1
    fi

    NPM_MAJOR_VERSION=$(npm -v | cut -d'.' -f1)
    if [ "$NPM_MAJOR_VERSION" -lt 10 ]; then
        echo "npm 10+ required. Current: $(npm -v)" >&2
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
        echo "Root dependencies not installed (run: npm install)" >&2
        exit 1
    fi

    if [ ! -d backend/node_modules ]; then
        echo "Backend dependencies not installed (run: npm install -w backend)" >&2
        exit 1
    fi

    if [ ! -d frontend/node_modules ]; then
        echo "Frontend dependencies not installed (run: npm install -w frontend)" >&2
        exit 1
    fi

[windows]
validate:
    #!pwsh.exe
    # HashHive validation - Windows (PowerShell)
    $nodeVersionOutput = node -v
    if (-not $nodeVersionOutput) {
        Write-Error "Node.js is not installed or not on PATH. Please install Node.js 20+ first."
        exit 1
    }

    $nodeMajorVersion = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
    if ($nodeMajorVersion -lt 20) {
        Write-Error "Node.js 20+ required. Current: $nodeVersionOutput"
        exit 1
    }

    $npmVersionOutput = npm -v
    $npmMajorVersion = [int]($npmVersionOutput.Split('.')[0])
    if ($npmMajorVersion -lt 10) {
        Write-Error "npm 10+ required. Current: $npmVersionOutput"
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
        Write-Warning "Root dependencies not installed (run: npm install)"
        exit 1
    }

    if (-not (Test-Path "backend/node_modules" -PathType Container)) {
        Write-Warning "Backend dependencies not installed (run: npm install -w backend)"
        exit 1
    }

    if (-not (Test-Path "frontend/node_modules" -PathType Container)) {
        Write-Warning "Frontend dependencies not installed (run: npm install -w frontend)"
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
[unix]
info:
    @echo "Node version: $(node -v)"
    @echo "npm version: $(npm -v)"
    @echo "Docker version: $(docker --version)"
    @echo ""
    @echo "Services:"
    @docker compose ps

[windows]
info:
    #!pwsh.exe
    Write-Output "Node version: $(node -v)"
    Write-Output "npm version: $(npm -v)"
    Write-Output "Docker version: $(docker --version)"
    Write-Output ""
    Write-Output "Services:"
    docker compose ps

# Restart a specific service
restart service:
    docker compose restart {{ service }}

# -----------------------------
# 🧹 Linting, Typing, Dep Check
# -----------------------------

# Lint all code (NX-powered)
lint:
    npx nx run-many --target=lint --all

# Format all code
format:
    npm run format

# Check code formatting
format-check:
    npm run format:check

# Run TypeScript type checking across all workspaces (NX-powered)
type-check:
    npx nx run-many --target=type-check --all

# -----------------------------
# 🧪 Testing & Coverage
# -----------------------------

# Run all tests (NX-powered)
test:
    npx nx run-many --target=test --all

# Run backend tests
test-backend:
    npx nx run backend:test

# Run frontend tests
test-frontend:
    npx nx run frontend:test

# Run integration tests
test-integration:
    npx nx run backend:test:integration

# Run E2E tests
test-e2e:
    npx nx run frontend:test:e2e

# Run tests in watch mode
test-watch:
    npm run test:watch -w backend

# Generate coverage report
coverage:
    npx nx run backend:test:coverage

# -----------------------------
# 📦 Build & Clean
# -----------------------------

# Build all packages (NX-powered)
build:
    npx nx run-many --target=build --all

# Build specific package
build-backend:
    npx nx run backend:build

build-frontend:
    npx nx run frontend:build

build-shared:
    npx nx run shared:build

# Clean build artifacts and dependencies
[unix]
clean:
    #!/usr/bin/env bash
    rm -rf node_modules
    rm -rf backend/node_modules backend/dist
    rm -rf frontend/node_modules frontend/.next
    rm -rf shared/node_modules shared/dist
    rm -rf coverage

[windows]
clean:
    #!pwsh.exe
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force backend/node_modules, backend/dist -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force frontend/node_modules, frontend/.next -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force shared/node_modules, shared/dist -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force coverage -ErrorAction SilentlyContinue

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
# Run the full CI check locally or in GitHub Actions (NX-powered).
# This relies on Jest + Testcontainers to provision MongoDB, Redis, and MinIO

# for the backend test suites, so no docker-compose step is required.
ci-check:
    npx nx run-many --target=lint,type-check,test,test:integration,test:e2e,test:coverage --parallel=3
    npm run format:check

# NX-specific commands
affected-test:
    npx nx affected --target=test

affected-build:
    npx nx affected --target=build

graph:
    npx nx graph

reset-cache:
    npx nx reset

# -----------------------------
# 📚 Documentation
# -----------------------------
# -----------------------------
# 🚢 Production Build & Deployment
# -----------------------------
