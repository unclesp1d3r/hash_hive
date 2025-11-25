# NX Integration

HashHive uses [NX](https://nx.dev) for monorepo tooling, providing intelligent caching, affected detection, and task orchestration.

## Setup

NX is installed as a dev dependency in the root `package.json`. After running `npm install`, NX is ready to use.

The NX configuration is defined in:
- `nx.json` - Root configuration for caching, task defaults, and workspace settings
- `backend/project.json` - Backend project targets and configuration
- `frontend/project.json` - Frontend project targets and configuration
- `shared/project.json` - Shared library project targets and configuration

## Commands

### Running Tasks

```bash
# Run a target for all projects
nx run-many --target=build --all
nx run-many --target=test --all
nx run-many --target=lint --all

# Run a target for a specific project
nx run backend:build
nx run frontend:test
nx run shared:lint

# Run multiple targets
nx run-many --target=lint,type-check,test --all
```

### Affected Commands

Only run tasks for projects affected by changes:

```bash
# Test affected projects
nx affected --target=test

# Build affected projects
nx affected --target=build

# Specify base branch
nx affected --target=test --base=main
nx affected --target=test --base=origin/main~1..HEAD
```

### Visualization

```bash
# Open interactive dependency graph
nx graph
```

### Cache Management

```bash
# Reset NX cache
nx reset

# View cache statistics
nx show projects
```

## Caching

NX caches task outputs based on:
- Input files (source code, config files)
- Command executed
- Environment variables (if configured)

Cached tasks include:
- `build` - TypeScript compilation outputs
- `test` - Test results and coverage
- `lint` - Linting results
- `type-check` - TypeScript type checking
- `test:integration` - Integration test results
- `test:e2e` - E2E test results
- `test:coverage` - Coverage reports

Cache is stored in `.nx/cache/` (gitignored). Tasks are automatically re-run if inputs change.

### Cache Configuration

Cache settings are defined in `nx.json`:
- `targetDefaults` - Default caching behavior per target
- `namedInputs` - Input file patterns for cache key calculation
- `tasksRunnerOptions` - Parallel execution and cache settings

## CI

The GitHub Actions CI workflow (`.github/workflows/ci.yml`) uses NX for:

1. **Pull Requests**: Runs `nx affected` to only test changed projects
2. **Main Branch**: Runs all tasks with `nx run-many`
3. **Caching**: Uses GitHub Actions cache for `.nx/cache` directory

The CI workflow:
- Caches NX cache directory between runs
- Uses affected detection for PRs (base: `origin/main~1..HEAD`)
- Runs tasks in parallel (configurable via `--parallel`)

## Troubleshooting

### Cache Issues

If you suspect cache corruption:

```bash
nx reset
```

This clears the local cache and forces a fresh run of all tasks.

### Task Not Running

Check if the task is defined in the project's `project.json`:

```bash
nx show project backend --json
```

### Dependency Issues

Visualize the dependency graph:

```bash
nx graph
```

This opens an interactive browser showing project dependencies and affected relationships.

### Performance

NX automatically parallelizes tasks. Adjust parallelism in `nx.json`:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "parallel": 5  // Adjust based on your machine
      }
    }
  }
}
```

## References

- [NX Documentation](https://nx.dev)
- [NX Configuration](https://nx.dev/nx-api/nx/documents/configuration)
- [NX Task Configuration](https://nx.dev/nx-api/nx/documents/run-commands-executor)

## Validation

Run these idiomatic commands to validate NX functionality:

### Dependency Graph

```bash
npx nx graph  # or just graph
npm run graph
```

**Expected:** Interactive graph shows shared → backend/frontend dependencies. Screenshot: `nx-dependency-graph.png`

### Individual Projects

```bash
npx nx build shared  # or just build-shared
npx nx build backend # or just build-backend (builds shared first)
npx nx build frontend # or just build-frontend (builds shared first)
npx nx test shared    # placeholder passes
npx nx test backend   # unit tests pass
npx nx test:integration backend # Testcontainers pass
npx nx test frontend  # Jest passes
npx nx test:e2e frontend # Playwright passes
```

### Bulk Operations

```bash
npm run build  # or just build
npm run test   # or just test
npm run lint   # or just lint
type-check     # or just type-check
```

**Expected:** Correct order (shared first), all pass.

### Caching

```bash
npx nx build shared  # 1st: cache miss
time npx nx build shared  # 2nd: cache hit (<100ms)
npx nx test backend  # 1st
npm run test  # 2nd: cache hits
just reset-cache  # clear
npm run build  # all rebuild
```

**Expected:** 10x+ speedup on repeats; invalidates on changes.

### Affected

```bash
git status  # clean
npx nx affected --target=test  # none
# Modify shared/src/index.ts, then:
npx nx affected --target=test --base=HEAD~1  # all 3 affected
```

### Full CI

```bash
just ci-check  # or npm run ci-check if added
```

**Expected:** All pass in parallel.

**Results:** [Record pass/fail, timings, screenshots here after running.]

## CI/CD Integration

HashHive's CI/CD pipeline leverages NX for intelligent task orchestration, providing significant performance improvements through affected detection and conditional execution.

### Overview

The GitHub Actions CI workflow (`.github/workflows/ci.yml`) uses NX to:

- **Detect affected projects**: Only runs tasks for projects that changed
- **Conditional execution**: Skips Docker pulls and tests when projects are unaffected
- **Leverage caching**: Uses both NX cache and GitHub Actions cache
- **Parallel execution**: Runs tasks in parallel for faster completion

### Affected Detection Strategy

The CI workflow determines which projects are affected using NX's affected detection:

**For Pull Requests:**
- Uses `github.event.pull_request.base.sha` as the base for comparison
- Command: `nx affected --target=test --base=$BASE_SHA`
- Only runs targets for projects that changed compared to the PR base

**For Pushes to Main:**
- Runs all targets to ensure full coverage
- Command: `nx run-many --target=test --all`
- Ensures nothing is missed on main branch

**Example commands:**
```bash
# See what would run in a PR
nx affected --target=test --base=origin/main

# See affected projects
nx show projects --affected --base=origin/main

# See affected graph
nx affected:graph --base=origin/main
```

### Conditional Execution

The CI workflow uses conditional execution to optimize performance:

**Docker Image Pulling:**
- Only pulls Docker images when `backend` is affected
- Condition: `if: env.BACKEND_AFFECTED == 'true'`
- Saves ~30-60 seconds on frontend-only or docs-only changes

**Integration Tests:**
- Only runs `test:integration` when backend is affected
- Backend integration tests require MongoDB, Redis, and MinIO containers

**E2E Tests:**
- Only runs `test:e2e` when frontend is affected
- Frontend E2E tests use Playwright

**Coverage Upload:**
- Only uploads coverage when backend tests ran
- Condition: `if: always() && env.BACKEND_AFFECTED == 'true'`

### Testing CI Workflow Locally

You can simulate the CI workflow behavior locally:

```bash
# See what would run in a PR (compared to main)
nx affected --target=test --base=origin/main

# See affected projects
nx show projects --affected --base=origin/main

# Run affected targets (simulates PR CI)
nx affected --target=lint,type-check,test --base=origin/main --parallel=3

# Test specific scenarios
# Frontend-only changes
nx affected --target=test --base=origin/main
# Should show: frontend

# Backend-only changes
nx affected --target=test --base=origin/main
# Should show: backend

# Shared changes (affects all)
nx affected --target=test --base=origin/main
# Should show: shared, backend, frontend
```

### CI Performance Optimization

**Expected Time Savings:**
- Frontend-only PR: ~60 seconds saved (no Docker pulls, no backend tests)
- Backend-only PR: ~30 seconds saved (no frontend E2E tests)
- Docs-only PR: ~3 minutes saved (only format:check runs)

**NX Caching in CI:**
- Cache key based on: `nx.json`, `project.json` files, `package-lock.json`
- Cache location: `.nx/cache/` (cached between workflow runs)
- Cache hit rate: Typically 50-80% for unchanged projects

**Debugging Cache Misses:**
```bash
# Check cache status
nx show projects --affected --base=origin/main

# Reset cache and rebuild
nx reset
nx run-many --target=build --all
```

### Troubleshooting

**Affected Detection Seems Wrong:**
- Ensure full git history is fetched: `fetch-depth: 0` in checkout step
- Check base SHA is correct: `echo $BASE_SHA` in workflow
- Verify git refs: `git log --oneline origin/main..HEAD`

**Force Full CI Run:**
- Push to `main` branch (runs all targets)
- Use `workflow_dispatch` with `force_run_all: true` input
- Manually trigger workflow with custom base SHA

**Common Issues with PRs from Forks:**
- GitHub Actions may have limited access to base branch
- Use `github.event.pull_request.base.sha` directly (already implemented)
- Fallback to `origin/main` if base SHA unavailable

### Example PR Scenarios

**Scenario 1: Frontend-only PR**
- Changes: `frontend/app/page.tsx`
- Affected: `frontend`
- Runs: frontend lint, type-check, test, test:e2e
- Skips: backend tests, Docker pulls, integration tests
- Time saved: ~60 seconds

**Scenario 2: Docs-only PR**
- Changes: `docs/README.md`
- Affected: none (docs not tracked by NX)
- Runs: only `format:check`
- Skips: all NX targets
- Time saved: ~3 minutes

**Scenario 3: Shared library change**
- Changes: `shared/src/types/index.ts`
- Affected: `shared`, `backend`, `frontend` (due to implicit dependencies)
- Runs: all targets (lint, type-check, test, test:integration, test:e2e, test:coverage)
- Includes: Docker pulls, all tests
- Time: Full CI run (~4-5 minutes)

**Scenario 4: Backend-only PR**
- Changes: `backend/src/routes/auth.routes.ts`
- Affected: `backend`
- Runs: backend lint, type-check, test, test:integration, test:coverage
- Skips: frontend E2E tests
- Includes: Docker pulls
- Time saved: ~30 seconds

### Workflow Files Reference

- **`.github/workflows/ci.yml`**: Main CI workflow with NX-powered affected detection
  - Key sections: affected detection, conditional Docker pulls, conditional test execution
  - See inline comments for detailed explanations

- **`.github/workflows/copilot-setup-steps.yml`**: Setup validation workflow
  - Uses NX commands for consistency
  - Validates development environment setup

- **`justfile`**: Local development commands
  - All commands use NX under the hood
  - See `just affected-ci-preview` for CI simulation
