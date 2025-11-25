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

## Advanced Features

HashHive leverages advanced NX features for optimal build performance, intelligent caching, and efficient task orchestration. This section covers fine-grained cache invalidation, task pipeline optimization, parallel execution tuning, retry strategies, Docker build caching, and NX Cloud integration.

### Advanced Caching Strategies

NX uses a sophisticated `namedInputs` system to determine when to invalidate caches. HashHive's configuration includes several named input patterns:

**Named Inputs:**

- **`dependencies`**: Package files (`package.json`, `package-lock.json`) that affect dependency resolution
- **`configuration`**: Build and tool configuration files (TypeScript, ESLint, Jest, Prettier configs)
- **`docker`**: Docker-related files (`Dockerfile`, `.dockerignore`, `docker-compose.yml`)
- **`environment`**: Environment variable files (`.env.example`, `.env.local`, `.env`)
- **`production`**: Production build inputs (excludes test files and test configs)
- **`testing`**: Test-specific inputs (includes test files and test configs)
- **`sharedGlobals`**: Root-level files that affect all projects (workspace `package.json`, `tsconfig.base.json`, `eslint.config.mjs`, `nx.json`)

**How Cache Invalidation Works:**

NX computes a hash of all input files for each target. If any input file changes, the cache is invalidated and the task re-runs. This ensures builds are only re-run when truly necessary.

**Example Cache Scenarios:**

```bash
# Scenario 1: Source file change (cache miss)
# Change: backend/src/routes/auth.routes.ts
# Result: backend:build cache invalidated, rebuilds

# Scenario 2: Dependency change (cache miss)
# Change: backend/package.json (added new dependency)
# Result: backend:build cache invalidated, rebuilds

# Scenario 3: Config change (cache miss)
# Change: tsconfig.json (changed compiler options)
# Result: backend:build and backend:type-check caches invalidated

# Scenario 4: Shared global change (cache miss for all projects)
# Change: tsconfig.base.json (changed base TypeScript config)
# Result: All projects' build and type-check caches invalidated

# Scenario 5: Test file change only (cache hit for build)
# Change: backend/tests/unit/auth.test.ts
# Result: backend:build cache hit (test files excluded from production input)
#         backend:test cache miss (test files included in testing input)
```

**Debugging Cache Configuration:**

```bash
# Show all targets for a project
just cache-config backend

# Show inputs for a specific target
just cache-inputs backend build

# Or use NX directly
npx nx show project backend --json | jq '.targets.build.inputs'
```

**Cache Statistics:**

```bash
# View cache directory size and contents
just cache-stats

# Run with verbose logging to debug cache misses
just debug-cache backend build
```

### Task Pipeline Optimization

NX automatically determines task execution order based on `dependsOn` relationships. HashHive's configuration ensures optimal task ordering:

**Dependency Graph:**

```
shared:build
  ├── backend:build (depends on ^build)
  │   └── backend:test:integration (depends on build)
  │   └── backend:test:coverage (depends on build)
  └── frontend:build (depends on ^build)
      └── frontend:test:e2e (depends on build)
```

**Key Relationships:**

- **`shared:build`** → **`backend:build`** / **`frontend:build`**: Shared library must build before apps
- **`backend:build`** → **`backend:test:integration`**: Code must compile before integration tests
- **`frontend:build`** → **`frontend:test:e2e`**: Next.js app must build before E2E tests

**Visualizing Dependencies:**

```bash
# Open interactive dependency graph
just graph

# Or use NX directly
npx nx graph
```

**Parallel vs Sequential Execution:**

NX runs independent tasks in parallel. Tasks with dependencies run sequentially:

```bash
# These run in parallel (no dependencies between them)
nx run backend:lint
nx run frontend:lint
nx run shared:lint

# These run sequentially (frontend depends on shared)
nx run shared:build
nx run frontend:build  # Waits for shared:build
```

### Parallel Execution Configuration

HashHive uses configurable parallel execution to optimize build performance:

**Current Settings:**

- **Default**: `parallel: 3` (configured in `nx.json`)
- **CI**: `parallel: 5` (GitHub Actions runners have 2-4 cores)
- **Override**: Use `NX_PARALLEL` environment variable or `--parallel` CLI flag

**Recommendations by Environment:**

- **Local Development**: 3-5 (based on CPU cores, default: 3)
- **CI Environments**: 5-10 (GitHub Actions runners have 2-4 cores, use 5 for optimal throughput)
- **Powerful Workstations**: Up to number of CPU cores (e.g., 8-16 for high-end machines)

**Overriding Parallelism:**

```bash
# Override for a single command
npx nx run-many --target=test --all --parallel=8

# Use justfile convenience command
just test-parallel 8

# Set environment variable (affects all commands)
export NX_PARALLEL=5
npx nx run-many --target=build --all
```

**Trade-offs:**

- **More Parallelism**: Faster execution but higher CPU/memory usage
- **Less Parallelism**: Lower resource usage but slower execution
- **Optimal**: Balance based on available resources (default: 3 is a good starting point)

### Task Retry Strategies

NX doesn't have built-in retry logic (by design), but test frameworks can be configured for retries:

**Jest (Backend Integration Tests):**

Integration tests use Jest's `testRetries` option configured in `backend/jest.integration.config.js`:

```javascript
// backend/jest.integration.config.js
module.exports = {
  testRetries: 2, // Retry failed tests up to 2 times
  // ... other config
};
```

**When to Use Retries:**

- Flaky tests due to Testcontainers startup timing
- Network issues with Docker containers
- Race conditions in async operations

**Best Practice:** Fix flaky tests rather than relying on retries. Retries should be a temporary mitigation.

**Playwright (Frontend E2E Tests):**

E2E tests use Playwright's built-in retry mechanism configured in `frontend/playwright.config.ts`:

```typescript
// frontend/playwright.config.ts
const config = defineConfig({
  retries: process.env.CI ? 2 : 1, // CI: 2 retries, local: 1 retry
  timeout: 30000, // 30 seconds per test
  // ... other config
});
```

**Retry Strategy:**

- **CI Environments**: 2 retries (handles infrastructure variability)
- **Local Development**: 1 retry (encourages fixing flaky tests)

**Debugging Flaky Tests:**

```bash
# Run with verbose logging
NX_VERBOSE_LOGGING=true npx nx run frontend:test:e2e

# Run specific test multiple times
npx playwright test --repeat-each=10 e2e/home.spec.ts
```

### Docker Build Caching

NX caches Docker build targets, but Docker layer caching provides additional performance benefits:

**NX Task Caching:**

NX caches the entire Docker build command. If inputs haven't changed, the build is skipped entirely.

**Docker BuildKit Layer Caching:**

Enable BuildKit for faster Docker builds with layer caching:

```bash
# Build with BuildKit caching
just docker-build-cached

# Or manually
DOCKER_BUILDKIT=1 docker build \
  --cache-from hashhive-backend:latest \
  -t hashhive-backend:latest \
  backend/
```

**Remote Docker Layer Caching (CI):**

For CI environments, export and import cache:

```bash
# Build with cache export
just docker-build-cache-export

# Or manually
DOCKER_BUILDKIT=1 docker build \
  --cache-from type=local,src=.docker-cache \
  --cache-to type=local,dest=.docker-cache \
  -t hashhive-backend:latest \
  backend/
```

**NX Cloud Integration:**

NX Cloud can distribute Docker layer cache across team members and CI runners. See [NX Cloud Integration](#nx-cloud-integration) section.

**Trade-offs:**

- **NX Task Caching**: Fast when inputs unchanged (skips entire build)
- **Docker Layer Caching**: Fast when only some layers changed (reuses unchanged layers)
- **Combined**: Best of both worlds (NX skips if possible, Docker optimizes if needed)

### NX Cloud Integration

NX Cloud provides distributed caching, task distribution, and analytics for teams:

**Benefits:**

- **Distributed Caching**: Share cache across team members and CI runners
- **Task Distribution**: Distribute tasks across multiple machines
- **Analytics**: Track build performance and cache hit rates
- **Free Tier**: Available for open-source projects

**Enabling NX Cloud:**

```bash
# Interactive setup
just nx-cloud-connect

# Or manually
npx nx connect-to-nx-cloud
```

This adds `nxCloudAccessToken` to `nx.json` and configures remote caching.

**Checking Status:**

```bash
# Check if NX Cloud is enabled
just nx-cloud-status
```

**CI Configuration:**

Add `NX_CLOUD_ACCESS_TOKEN` to GitHub Actions secrets and uncomment the NX Cloud step in `.github/workflows/ci.yml`.

**Cost Considerations:**

- **Free Tier**: Unlimited for open-source projects
- **Paid Plans**: Available for private repositories
- **See**: [NX Cloud Pricing](https://nx.app/pricing)

**When to Consider NX Cloud:**

- Team size: 5+ developers
- CI time: >5 minutes per run
- Cache hit rate: <50% locally
- Multiple CI runners: Want shared cache across runners

### Cache Debugging and Troubleshooting

**Inspecting Cache Configuration:**

```bash
# Show all targets for a project
just cache-config backend

# Show inputs for a specific target
just cache-inputs backend build

# Or use NX directly
npx nx show project backend --json | jq '.targets'
```

**Debugging Cache Misses:**

```bash
# Run with verbose logging
just debug-cache backend build

# Or manually
NX_VERBOSE_LOGGING=true npx nx run backend:build
```

**Common Cache Miss Scenarios:**

1. **Shared Globals Changed**: Affects all projects
   - Example: `tsconfig.base.json` changed
   - Result: All projects' build/type-check caches invalidated

2. **Dependencies Changed**: Affects project-specific targets
   - Example: `backend/package.json` changed
   - Result: `backend:build` cache invalidated

3. **Configuration Changed**: Affects related targets
   - Example: `backend/tsconfig.json` changed
   - Result: `backend:build` and `backend:type-check` caches invalidated

4. **Source Files Changed**: Obvious cache miss
   - Example: `backend/src/routes/auth.routes.ts` changed
   - Result: `backend:build` cache invalidated

**Clearing Cache:**

```bash
# Reset NX cache
just reset-cache

# Or manually
npx nx reset
```

**Cache Statistics:**

```bash
# View cache directory size and contents
just cache-stats
```

### Performance Optimization Tips

**Best Practices:**

1. **Keep `namedInputs` Specific**: Avoid overly broad patterns like `{projectRoot}/**/*`
2. **Use `production` Input for Builds**: Excludes test files from build cache invalidation
3. **Use `testing` Input for Tests**: Includes test configs in test cache invalidation
4. **Leverage `sharedGlobals`**: Root-level configs affect all projects automatically

**Measuring Cache Effectiveness:**

```bash
# Benchmark cache performance
just benchmark-cache

# Expected results:
# - First run (cache miss): 10-30 seconds
# - Second run (cache hit): <1 second (10-100x faster)
```

**Expected Performance Improvements:**

- **Cache Hits**: 10-100x faster (milliseconds vs seconds)
- **Affected Detection**: 50-80% time savings on PRs
- **Parallel Execution**: 2-3x faster with 3-5 parallel tasks

**Optimizing for Your Machine:**

```bash
# Test different parallelism levels
just test-parallel 3  # Default
just test-parallel 5  # Moderate
just test-parallel 8  # Aggressive

# Find optimal setting for your CPU
nproc  # Linux: shows CPU count
sysctl -n hw.ncpu  # macOS: shows CPU count
```

## References
