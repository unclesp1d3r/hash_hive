# NX Validation Checklist

This document provides step-by-step instructions for verifying all NX features work correctly after the integration. Use this checklist after initial NX setup, after major changes, or when troubleshooting NX-related issues.

## Introduction

This validation checklist ensures that all NX features are properly configured and working as expected. It covers:

- Dependency graph validation
- Individual project commands
- Bulk operations
- Caching functionality
- Affected detection
- CI simulation
- Advanced features
- Performance benchmarks

**When to use this checklist:**

- After initial NX setup
- After making major changes to NX configuration
- When troubleshooting NX-related issues
- Before committing significant changes to NX configuration
- When onboarding new team members

## Prerequisites

Before running the validation checklist, ensure you have:

- **Node.js 20+** and **npm 10+** installed
- **Docker** and **Docker Compose** installed and running
- **just** command runner installed (optional, but recommended)
- **Git** installed and repository cloned

**Initial setup:**

```bash
# Install dependencies
npm install

# Start infrastructure services (if not already running)
docker compose up -d

# Verify services are running
docker compose ps
```

## 1. Dependency Graph Validation

Verify that the dependency graph correctly shows project relationships.

### Commands

```bash
# Open interactive dependency graph
just graph
# or
npm run graph
# or
npx nx graph
```

### Expected Output

- Interactive graph opens in browser
- Shows `shared` as a dependency of both `backend` and `frontend`
- Graph visualization displays correct dependency relationships

### Validation Steps

1. Run `just graph` or `npm run graph`
2. Verify the graph opens in your default browser
3. Check that `shared` appears as a dependency of `backend` and `frontend`
4. Take a screenshot for documentation (optional): `nx-dependency-graph.png`

### Success Criteria

- [ ] Graph opens successfully
- [ ] `shared` → `backend` dependency visible
- [ ] `shared` → `frontend` dependency visible
- [ ] No circular dependencies shown

## 2. Individual Project Commands

Validate that each project's targets work correctly.

### Shared Package

```bash
# Build shared
npx nx build shared
# or
just build-shared

# Test shared (placeholder)
npx nx test shared
# or
npx nx run shared:test

# Lint shared
npx nx lint shared
# or
npx nx run shared:lint

# Type check shared
npx nx type-check shared
# or
npx nx run shared:type-check
```

**Expected Output:**
- Build completes successfully (~2-5 seconds)
- Test passes (placeholder: "No tests yet")
- Lint passes with no errors
- Type check passes with no errors

### Backend Package

```bash
# Build backend (should build shared first)
npx nx build backend
# or
just build-backend

# Test backend
npx nx test backend
# or
just test-backend

# Integration tests
npx nx run backend:test:integration
# or
just test-integration

# Coverage
npx nx run backend:test:coverage
# or
just coverage

# Lint backend
npx nx lint backend
# or
npx nx run backend:lint

# Type check backend
npx nx type-check backend
# or
npx nx run backend:type-check
```

**Expected Output:**
- Build completes successfully (~5-10 seconds)
- Unit tests pass
- Integration tests pass (requires Docker)
- Coverage report generated
- Lint passes with no errors
- Type check passes with no errors

**Note:** Backend build should automatically build `shared` first due to `dependsOn: ["^build"]` configuration.

### Frontend Package

```bash
# Build frontend (should build shared first)
npx nx build frontend
# or
just build-frontend

# Test frontend
npx nx test frontend
# or
just test-frontend

# E2E tests
npx nx run frontend:test:e2e
# or
just test-e2e

# Lint frontend
npx nx lint frontend
# or
npx nx run frontend:lint

# Type check frontend
npx nx type-check frontend
# or
npx nx run frontend:type-check
```

**Expected Output:**
- Build completes successfully (~10-30 seconds for Next.js)
- Unit tests pass
- E2E tests pass (requires frontend to be built)
- Lint passes with no errors
- Type check passes with no errors

**Note:** Frontend build should automatically build `shared` first due to `dependsOn: ["^build"]` configuration.

### Success Criteria

- [ ] All shared targets pass
- [ ] All backend targets pass
- [ ] All frontend targets pass
- [ ] Build order is correct (shared → backend/frontend)
- [ ] No errors or warnings

## 3. Bulk Operations

Validate that `run-many` commands work correctly for all projects.

### Commands

```bash
# Build all packages
npm run build
# or
just build

# Test all packages
npm run test
# or
just test

# Lint all packages
npm run lint
# or
just lint

# Type check all packages
npm run type-check
# or
just type-check

# Run multiple targets
npx nx run-many --targets=lint,type-check,test --all --parallel=3
```

### Expected Output

- Tasks execute in correct order (shared first, then backend/frontend in parallel)
- All tasks complete successfully
- Parallel execution works (3 tasks at a time by default)
- Output shows task execution order

### Execution Order

Expected order for `npm run build`:

1. `shared:build` (runs first)
2. `backend:build` and `frontend:build` (run in parallel after shared completes)

### Success Criteria

- [ ] All bulk operations complete successfully
- [ ] Execution order is correct
- [ ] Parallel execution works (configurable via `--parallel`)
- [ ] No errors or warnings

## 4. Caching Functionality

Verify that NX caching works correctly.

### Cache Miss (First Run)

```bash
# Clear cache first
npx nx reset
# or
just reset-cache

# Run build (cache miss)
npx nx build shared
# Expected: Actual build execution, takes ~2-5 seconds
```

### Cache Hit (Second Run)

```bash
# Run same build again (cache hit)
npx nx build shared
# Expected: "[existing outputs match the cache, left as is]" - completes in <1 second
```

### Cache Verification

```bash
# Verify cache statistics
just cache-stats

# Benchmark cache performance
just benchmark-cache
```

### Expected Performance

- **Cache Miss**: 5-30 seconds (depending on project size)
- **Cache Hit**: <1 second (10-100x faster)

### Cache Invalidation Test

```bash
# 1. Build backend (cache miss)
npx nx build backend

# 2. Build backend again (cache hit - should be instant)
npx nx build backend

# 3. Modify a source file
echo "// test" >> backend/src/index.ts

# 4. Build backend again (cache miss - should rebuild)
npx nx build backend

# 5. Revert the change
git checkout backend/src/index.ts

# 6. Build backend again (cache hit - should be instant)
npx nx build backend
```

### Success Criteria

- [ ] Cache miss executes actual build
- [ ] Cache hit uses cached results (<1 second)
- [ ] Cache invalidates when source files change
- [ ] Cache statistics command works
- [ ] Benchmark shows 10-100x speedup on cache hits

## 5. Affected Detection

Validate that NX correctly detects affected projects.

### Check Affected Projects

```bash
# Show affected projects (compared to main branch)
just affected-projects
# or
npx nx show projects --affected --base=origin/main
```

### Test Scenarios

#### Scenario 1: No Changes

```bash
# Ensure working tree is clean
git status

# Check affected projects
npx nx affected --target=test --base=origin/main
# Expected: No projects affected (or only current branch changes)
```

#### Scenario 2: Frontend-Only Changes

```bash
# Make a change to frontend
echo "// test" >> frontend/app/page.tsx

# Check affected projects
npx nx show projects --affected --base=HEAD~1
# Expected: frontend

# Check affected targets
npx nx affected --target=test --base=HEAD~1
# Expected: frontend:test runs
```

#### Scenario 3: Backend-Only Changes

```bash
# Revert previous change
git checkout frontend/app/page.tsx

# Make a change to backend
echo "// test" >> backend/src/index.ts

# Check affected projects
npx nx show projects --affected --base=HEAD~1
# Expected: backend

# Check affected targets
npx nx affected --target=test --base=HEAD~1
# Expected: backend:test runs
```

#### Scenario 4: Shared Changes (Affects All)

```bash
# Revert previous change
git checkout backend/src/index.ts

# Make a change to shared
echo "// test" >> shared/src/index.ts

# Check affected projects
npx nx show projects --affected --base=HEAD~1
# Expected: shared, backend, frontend (all three)

# Check affected targets
npx nx affected --target=test --base=HEAD~1
# Expected: All three projects' tests run
```

#### Scenario 5: Docs-Only Changes

```bash
# Revert previous change
git checkout shared/src/index.ts

# Make a change to docs (not tracked by NX)
echo "# test" >> docs/README.md

# Check affected projects
npx nx show projects --affected --base=HEAD~1
# Expected: No projects affected (docs not in NX projects)
```

### Success Criteria

- [ ] Affected detection works for frontend-only changes
- [ ] Affected detection works for backend-only changes
- [ ] Affected detection works for shared changes (affects all)
- [ ] Docs-only changes don't affect any projects
- [ ] Affected commands only run for changed projects

## 6. CI Simulation

Simulate the CI workflow locally to verify it works correctly.

### Preview CI Workflow

```bash
# Preview what CI would run
just affected-ci-preview
# or
npx nx affected --targets=lint,type-check,test --base=origin/main --dry-run
```

### Simulate PR CI

```bash
# Run affected targets (simulates PR CI)
just ci-affected
# or manually:
npx nx affected --targets=lint,type-check,test --base=origin/main --parallel=3
npx nx affected --target=test:integration --base=origin/main --parallel=3
npx nx affected --target=test:coverage --base=origin/main --parallel=3
npx nx affected --target=test:e2e --base=origin/main --parallel=3
npm run format:check
```

### Full CI Check

```bash
# Run full CI check (all targets, not affected-only)
just ci-check
# or
npm run ci-check
```

### Expected Behavior

- **PR CI (affected)**: Only runs targets for changed projects
- **Main CI (full)**: Runs all targets regardless of changes
- **Conditional execution**: Skips Docker pulls and integration tests when backend is unaffected
- **Parallel execution**: Runs tasks in parallel (default: 3)

### Success Criteria

- [ ] CI preview shows correct affected projects
- [ ] Affected CI simulation runs only changed projects
- [ ] Full CI check runs all projects
- [ ] Conditional execution works correctly
- [ ] Parallel execution works as expected

## 7. Advanced Features

Validate advanced NX features.

### Parallel Execution Tuning

```bash
# Run with default parallelism (3)
npx nx run-many --target=test --all

# Run with custom parallelism
just test-parallel 8
# or
npx nx run-many --target=test --all --parallel=8
```

**Expected:** Tasks run in parallel, completion time decreases with higher parallelism (up to a point).

### Retry Logic

```bash
# Run integration tests (should retry on failure)
npx nx run backend:test:integration

# Run E2E tests (should retry on failure)
npx nx run frontend:test:e2e
```

**Expected:** Tests retry automatically on failure (integration: 2 retries, E2E: 1 retry locally, 2 in CI).

### Docker Build Caching

```bash
# Build with BuildKit caching
just docker-build-cached
```

**Expected:** Docker build uses layer caching for faster subsequent builds.

### Cache Debugging

```bash
# Debug cache misses
just debug-cache backend build
# or
NX_VERBOSE_LOGGING=true npx nx run backend:build
```

**Expected:** Verbose logging shows cache hit/miss reasons.

### Cache Configuration Inspection

```bash
# Show cache configuration
just cache-config backend

# Show cache inputs
just cache-inputs backend build
```

**Expected:** Shows target configuration and input patterns.

### Success Criteria

- [ ] Parallel execution tuning works
- [ ] Retry logic works for integration and E2E tests
- [ ] Docker build caching works
- [ ] Cache debugging provides useful information
- [ ] Cache configuration inspection works

## 8. Performance Benchmarks

Measure and validate performance improvements.

### Cache Performance

```bash
# Benchmark cache performance
just benchmark-cache
```

**Expected Results:**
- First run (cache miss): 10-30 seconds
- Second run (cache hit): <1 second
- Speedup: 10-100x faster

### Affected Detection Performance

```bash
# Time affected detection
time npx nx affected --target=test --base=origin/main

# Time full test run
time npm run test
```

**Expected:** Affected detection saves 50-80% of time on PRs.

### Parallel Execution Performance

```bash
# Time with default parallelism (3)
time npx nx run-many --target=test --all --parallel=3

# Time with higher parallelism (8)
time npx nx run-many --target=test --all --parallel=8
```

**Expected:** Higher parallelism reduces total execution time (up to a point, then plateaus).

### Success Criteria

- [ ] Cache benchmark shows 10-100x speedup
- [ ] Affected detection saves significant time
- [ ] Parallel execution improves performance
- [ ] Performance meets or exceeds expectations

## 9. Troubleshooting

Common issues and solutions.

### Cache Corruption

**Symptoms:** Builds seem stale, tests fail unexpectedly

**Solution:**
```bash
npx nx reset
# or
just reset-cache
```

### Task Not Running

**Symptoms:** Task doesn't execute, shows "not found" error

**Solution:**
- Verify task exists in `project.json`
- Check task name matches exactly (e.g., `test:integration` not `test-integration`)
- Run `npx nx show project <project> --json` to see available targets

### Affected Detection Wrong

**Symptoms:** Affected detection shows incorrect projects

**Solution:**
- Ensure comparing against correct base branch (`origin/main`)
- Verify changes are in the projects you expect
- Use `just affected-projects` to see what NX detected
- Check git history is complete: `git fetch --unshallow` if needed

### Performance Issues

**Symptoms:** Tasks run slowly, cache not working

**Solution:**
- Check cache statistics: `just cache-stats`
- Verify cache directory exists: `.nx/cache/`
- Check parallelism settings in `nx.json`
- Run with verbose logging: `NX_VERBOSE_LOGGING=true npx nx run <project>:<target>`

### Dependency Graph Issues

**Symptoms:** Build order incorrect, dependencies not recognized

**Solution:**
- Verify `implicitDependencies` in `project.json`
- Check `dependsOn` relationships
- Visualize graph: `just graph`
- Verify TypeScript project references in `tsconfig.json`

## 10. Results Template

Use this template to record validation results.

### Validation Results

**Date:** _______________

**Validator:** _______________

**Environment:**
- Node.js version: _______________
- npm version: _______________
- OS: _______________
- Docker version: _______________

### Checklist Results

| Section | Status | Notes |
|---------|--------|-------|
| 1. Dependency Graph | ☐ Pass ☐ Fail | |
| 2. Individual Projects | ☐ Pass ☐ Fail | |
| 3. Bulk Operations | ☐ Pass ☐ Fail | |
| 4. Caching | ☐ Pass ☐ Fail | |
| 5. Affected Detection | ☐ Pass ☐ Fail | |
| 6. CI Simulation | ☐ Pass ☐ Fail | |
| 7. Advanced Features | ☐ Pass ☐ Fail | |
| 8. Performance Benchmarks | ☐ Pass ☐ Fail | |

### Performance Metrics

| Metric | Value | Expected | Status |
|--------|-------|----------|--------|
| Cache hit speedup | ___________ | 10-100x | ☐ Pass ☐ Fail |
| Affected detection time savings | ___________ | 50-80% | ☐ Pass ☐ Fail |
| Parallel execution speedup | ___________ | 2-3x | ☐ Pass ☐ Fail |

### Issues Found

1. _______________
2. _______________
3. _______________

### Notes

_______________

## Additional Resources

- **[`docs/NX_SETUP.md`](NX_SETUP.md)**: Comprehensive NX setup documentation
- **[`docs/NX_OPTIMIZATION_GUIDE.md`](NX_OPTIMIZATION_GUIDE.md)**: Optimization best practices
- **[`README.md`](../README.md#nx-monorepo-tooling)**: Quick reference for NX commands
- **[`CONTRIBUTING.md`](../CONTRIBUTING.md#nx-monorepo-tooling)**: Development workflow with NX
- **[NX Official Docs](https://nx.dev)**: Complete NX documentation
