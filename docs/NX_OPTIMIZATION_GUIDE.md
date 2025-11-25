# NX Optimization Guide

This guide documents best practices, performance tuning, and advanced configuration for the HashHive NX monorepo. Use this guide to understand optimization strategies, when to apply them, and how to measure their impact.

## Introduction

This optimization guide covers:

- Package.json scripts optimization
- ESLint configuration best practices
- TypeScript project references
- Cache optimization strategies
- Parallel execution tuning
- CI/CD optimization
- Docker build optimization
- NX Cloud considerations
- Monitoring and metrics
- Scaling strategies
- Common anti-patterns

**When to use this guide:**

- Setting up a new NX monorepo
- Optimizing build performance
- Troubleshooting cache issues
- Scaling the monorepo
- Understanding advanced NX features

## Package.json Scripts Optimization

### Why Workspace-Level Scripts Are Necessary

NX wraps workspace-level scripts defined in each package's `package.json`. These scripts are necessary because:

1. **NX uses them as executors**: NX's `run-commands` executor calls these scripts
2. **Workspace compatibility**: Scripts work with npm workspaces and other tools
3. **Project-specific configuration**: Each project may need different flags or options

### Current Setup Analysis

The current HashHive setup has **no redundant scripts**. Each script serves a purpose:

- **Root `package.json`**: Orchestrates workspace-level commands using NX
- **Workspace `package.json` files**: Define project-specific targets that NX wraps

### When to Add New Scripts

Add new scripts when:

- A new target is needed (e.g., `test:integration`, `test:e2e`)
- Project-specific flags are required (e.g., `jest --coverage`)
- Tooling requires specific command formats

**Example:**
```json
// backend/package.json
{
  "scripts": {
    "test:integration": "jest --config jest.integration.config.js"
  }
}
```

This script is then wrapped by NX in `backend/project.json`:

```json
{
  "targets": {
    "test:integration": {
      "executor": "nx:run-commands",
      "options": {
        "command": "jest --config jest.integration.config.js",
        "cwd": "backend"
      }
    }
  }
}
```

### Keeping Scripts Minimal

**Best practices:**

- Keep scripts focused on a single task
- Avoid complex shell logic in scripts (use `project.json` executors instead)
- Document non-obvious scripts with comments in `package.json` (if supported) or README

**Anti-pattern:**
```json
// ❌ Don't do this
{
  "scripts": {
    "build": "npm run clean && tsc && npm run copy-assets && npm run minify"
  }
}
```

**Better approach:**
```json
// ✅ Use NX dependsOn instead
{
  "targets": {
    "build": {
      "dependsOn": ["clean", "copy-assets"],
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc"
      }
    }
  }
}
```

## ESLint Configuration

### Current Flat Config Approach

HashHive uses ESLint's flat config format (ESLint 9+), which is optimal for monorepos:

```javascript
// eslint.config.mjs
export default [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Shared rules
    }
  }
];
```

### Why @nx/eslint-plugin Is Not Needed

The `@nx/eslint-plugin` provides workspace-level linting rules and boundary enforcement. However, for HashHive's current structure:

- **Flat config is sufficient**: The current ESLint setup already handles workspace-level linting
- **3-package structure**: Boundary rules are not needed yet (only 3 packages: shared, backend, frontend)
- **No circular dependencies**: Current structure prevents circular dependencies naturally

### When to Consider @nx/eslint-plugin

Consider adding `@nx/eslint-plugin` when:

- **Monorepo grows**: 5+ packages with complex dependencies
- **Boundary enforcement needed**: Want to enforce that `shared` doesn't import from `backend`/`frontend`
- **Workspace-level rules**: Need project-specific ESLint rules

**Example boundary rule (when needed):**
```javascript
// eslint.config.mjs
import nxEslintPlugin from '@nx/eslint-plugin';

export default [
  {
    plugins: {
      '@nx': nxEslintPlugin,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              sourceTag: 'shared',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'backend',
              onlyDependOnLibsWithTags: ['shared'],
            },
            {
              sourceTag: 'frontend',
              onlyDependOnLibsWithTags: ['shared'],
            },
          ],
        },
      ],
    },
  },
];
```

### Workspace-Level Linting Rules

The current setup uses a shared ESLint config at the root level. This is optimal for:

- Consistent rules across all packages
- Single source of truth for linting configuration
- Easier maintenance

**When to split linting rules:**

- Packages need significantly different rules (e.g., React-specific rules only for frontend)
- Performance issues with shared config
- Team preferences for package-specific rules

## TypeScript Project References

### Benefits of Composite Project References

TypeScript project references provide:

1. **Incremental builds**: Only rebuild changed projects and dependents
2. **Better type checking**: TypeScript understands dependency relationships
3. **IDE support**: Better IntelliSense and navigation
4. **Type consistency**: Ensures types are consistent across packages

### Current Setup

**Shared package** (`shared/tsconfig.json`):
```json
{
  "compilerOptions": {
    "composite": true
  }
}
```

**Backend package** (`backend/tsconfig.json`):
```json
{
  "references": [
    {
      "path": "../shared"
    }
  ]
}
```

**Frontend package** (`frontend/tsconfig.json`):
```json
{
  "references": [
    {
      "path": "../shared"
    }
  ]
}
```

### How It Works

1. **Shared** has `composite: true`, making it a referenceable project
2. **Backend** and **Frontend** reference `shared` via the `references` array
3. TypeScript ensures `shared` is built before `backend`/`frontend`
4. Type checking includes types from referenced projects

### When to Add More References

As the monorepo grows, add references when:

- New packages are created (e.g., `common`, `utils`)
- Packages depend on each other (e.g., `backend` depends on `common`)
- You want incremental compilation benefits

**Example:**
```json
// backend/tsconfig.json
{
  "references": [
    { "path": "../shared" },
    { "path": "../common" }
  ]
}
```

### Best Practices

- **Always set `composite: true`** on packages that will be referenced
- **Use `references` array** to declare dependencies
- **Keep references minimal**: Only reference what's actually needed
- **Verify with `tsc --build`**: Ensures project references work correctly

## Cache Optimization Strategies

### Understanding Named Inputs

NX uses `namedInputs` to determine cache invalidation. HashHive's configuration includes:

```json
// nx.json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "dependencies": [
      "{projectRoot}/package.json",
      "{workspaceRoot}/package-lock.json"
    ],
    "configuration": [
      "{projectRoot}/tsconfig*.json",
      "{projectRoot}/eslint.config.*",
      "{projectRoot}/jest*.config.*"
    ],
    "testing": [
      "dependencies",
      "configuration",
      "default",
      "{projectRoot}/**/*.test.{ts,tsx,js,jsx}"
    ],
    "production": [
      "dependencies",
      "configuration",
      "default",
      "!{projectRoot}/**/*.test.{ts,tsx,js,jsx}"
    ]
  }
}
```

### When to Create Custom Named Inputs

Create custom `namedInputs` when:

- **Specific file patterns affect a target**: e.g., only `.graphql` files affect code generation
- **Environment-specific inputs**: e.g., `.env` files affect build output
- **External dependencies**: e.g., generated files from external tools

**Example:**
```json
{
  "namedInputs": {
    "graphql": [
      "{projectRoot}/**/*.graphql",
      "{projectRoot}/codegen.yml"
    ]
  },
  "targetDefaults": {
    "codegen": {
      "inputs": ["graphql", "default"]
    }
  }
}
```

### Debugging Cache Misses

**Common scenarios:**

1. **Shared globals changed**: Affects all projects
   ```bash
   # Change tsconfig.base.json
   # Result: All projects' build/type-check caches invalidated
   ```

2. **Dependencies changed**: Affects project-specific targets
   ```bash
   # Change backend/package.json
   # Result: backend:build cache invalidated
   ```

3. **Configuration changed**: Affects related targets
   ```bash
   # Change backend/tsconfig.json
   # Result: backend:build and backend:type-check caches invalidated
   ```

4. **Source files changed**: Obvious cache miss
   ```bash
   # Change backend/src/index.ts
   # Result: backend:build cache invalidated
   ```

**Debugging commands:**
```bash
# Show cache inputs for a target
just cache-inputs backend build

# Run with verbose logging
just debug-cache backend build

# Check cache statistics
just cache-stats
```

### Strategies for Maximizing Cache Hit Rates

1. **Keep `namedInputs` specific**: Avoid overly broad patterns
2. **Use `production` input for builds**: Excludes test files
3. **Use `testing` input for tests**: Includes test configs
4. **Leverage `sharedGlobals`**: Root-level configs affect all projects automatically

**Example optimization:**
```json
// ❌ Too broad
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  }
}

// ✅ More specific
{
  "namedInputs": {
    "default": [
      "{projectRoot}/src/**/*",
      "{projectRoot}/public/**/*",
      "!{projectRoot}/**/*.test.{ts,tsx}"
    ]
  }
}
```

## Parallel Execution Tuning

### Current Configuration

HashHive uses configurable parallel execution:

```json
// nx.json
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "parallel": 3
      }
    }
  }
}
```

### Guidelines by Environment

**Local Development:**
- **Default**: 3 tasks (optimal for most machines)
- **Powerful workstations**: 5-8 tasks (based on CPU cores)
- **Laptops**: 2-3 tasks (to avoid overheating)

**CI Environments:**
- **GitHub Actions**: 5 tasks (runners have 2-4 cores)
- **Self-hosted**: Match CPU cores (e.g., 8-16 for powerful runners)
- **Cloud CI**: 5-10 tasks (based on runner specs)

**Measuring Performance:**
```bash
# Test different parallelism levels
time npx nx run-many --target=test --all --parallel=3
time npx nx run-many --target=test --all --parallel=5
time npx nx run-many --target=test --all --parallel=8
```

### Trade-offs

- **More Parallelism**: Faster execution but higher CPU/memory usage
- **Less Parallelism**: Lower resource usage but slower execution
- **Optimal**: Balance based on available resources (default: 3 is a good starting point)

### Overriding Parallelism

```bash
# Override for a single command
npx nx run-many --target=test --all --parallel=8

# Use justfile convenience command
just test-parallel 8

# Set environment variable (affects all commands)
export NX_PARALLEL=5
npx nx run-many --target=build --all
```

## CI/CD Optimization

### Affected Detection Strategy

The CI workflow uses affected detection for pull requests:

```yaml
# .github/workflows/ci.yml
- name: Run affected tests
  run: npx nx affected --target=test --base=${{ github.event.pull_request.base.sha }}
```

**Benefits:**
- Only runs tests for changed projects
- Saves 50-80% of CI time on PRs
- Faster feedback for developers

### Conditional Execution

The CI workflow conditionally executes steps:

```yaml
# Only pull Docker images when backend is affected
- name: Pull Docker images
  if: env.BACKEND_AFFECTED == 'true'
  run: docker compose pull

# Only run integration tests when backend is affected
- name: Integration tests
  if: env.BACKEND_AFFECTED == 'true'
  run: npx nx run backend:test:integration
```

**Time savings:**
- Frontend-only PR: ~60 seconds saved (no Docker pulls, no backend tests)
- Backend-only PR: ~30 seconds saved (no frontend E2E tests)
- Docs-only PR: ~3 minutes saved (only format:check runs)

### Cache Configuration for GitHub Actions

```yaml
# Cache NX cache directory
- name: Cache NX
  uses: actions/cache@v4
  with:
    path: .nx/cache
    key: nx-${{ runner.os }}-${{ hashFiles('**/nx.json', '**/project.json', '**/package-lock.json') }}
    restore-keys: |
      nx-${{ runner.os }}-
```

**Cache key strategy:**
- Include `nx.json` and `project.json` files (configuration changes invalidate cache)
- Include `package-lock.json` (dependency changes invalidate cache)
- Use OS-specific keys (different OS = different cache)

### Performance Monitoring

Track CI performance over time:

- **Cache hit rate**: Should be 50-80% for unchanged projects
- **Average CI time**: Track for PRs vs main branch
- **Affected detection accuracy**: Verify only changed projects run

## Docker Build Optimization

### Why docker-build Has cache: false

The `docker-build` target has `cache: false` in `backend/project.json`:

```json
{
  "targets": {
    "docker-build": {
      "cache": false,
      "dependsOn": ["build"]
    }
  }
}
```

**Reasoning:**
- Docker has its own sophisticated layer caching via BuildKit
- Docker layer caching is more granular (layer-by-layer) than NX task caching
- Docker builds are typically run less frequently than other targets

### Using BuildKit Layer Caching

Enable BuildKit for faster Docker builds:

```bash
# Build with BuildKit caching
just docker-build-cached
# or
DOCKER_BUILDKIT=1 docker build \
  --cache-from hashhive-backend:latest \
  -t hashhive-backend:latest \
  backend/
```

**Benefits:**
- Reuses unchanged layers from previous builds
- Only rebuilds layers that changed
- Significantly faster for incremental builds

### Remote Cache in CI

For CI environments, export and import cache:

```bash
# Build with cache export
just docker-build-cache-export
# or
DOCKER_BUILDKIT=1 docker build \
  --cache-from type=local,src=.docker-cache \
  --cache-to type=local,dest=.docker-cache \
  -t hashhive-backend:latest \
  backend/
```

**CI integration:**
- Store `.docker-cache` in GitHub Actions cache
- Restore cache before Docker build
- Export cache after successful build

## NX Cloud Considerations

### When to Adopt NX Cloud

Consider NX Cloud when:

- **Team size**: 5+ developers
- **CI time**: >5 minutes per run
- **Cache hit rate**: <50% locally
- **Multiple CI runners**: Want shared cache across runners

### Benefits

- **Distributed caching**: Share cache across team members and CI runners
- **Task distribution**: Distribute tasks across multiple machines
- **Analytics**: Track build performance and cache hit rates
- **Free tier**: Available for open-source projects

### Setup

```bash
# Interactive setup
just nx-cloud-connect
# or
npx nx connect-to-nx-cloud
```

This adds `nxCloudAccessToken` to `nx.json` and configures remote caching.

### Cost Considerations

- **Free tier**: Unlimited for open-source projects
- **Paid plans**: Available for private repositories
- **See**: [NX Cloud Pricing](https://nx.app/pricing)

### Checking Status

```bash
# Check if NX Cloud is enabled
just nx-cloud-status
```

## Monitoring and Metrics

### Cache Statistics

```bash
# View cache directory size and contents
just cache-stats
```

**What to monitor:**
- Cache directory size (should grow over time)
- Cache hit rate (should be 50-80% for unchanged projects)
- Cache invalidation frequency (should match change frequency)

### Build Performance

```bash
# Benchmark cache performance
just benchmark-cache
```

**Expected results:**
- First run (cache miss): 10-30 seconds
- Second run (cache hit): <1 second
- Speedup: 10-100x faster

### Identifying Bottlenecks

```bash
# Run with timing
time npx nx run-many --target=build --all

# Run with verbose logging
NX_VERBOSE_LOGGING=true npx nx run-many --target=build --all
```

**Common bottlenecks:**
- Slow dependency installation (npm install)
- Large source files (consider code splitting)
- Inefficient test suites (consider test optimization)
- Network latency (for remote operations)

## Scaling Strategies

### Adding New Packages

When adding new packages:

1. **Create `project.json`**: Define targets and configuration
2. **Add to workspace**: Update root `package.json` workspaces array
3. **Configure dependencies**: Set `implicitDependencies` if needed
4. **Add TypeScript references**: If using composite project references
5. **Update CI workflow**: Ensure new package is included in affected detection

### Splitting Large Packages

When a package becomes too large:

1. **Identify boundaries**: Find logical separation points
2. **Create new packages**: Extract functionality into separate packages
3. **Update dependencies**: Add `implicitDependencies` and TypeScript references
4. **Migrate gradually**: Move code incrementally to avoid breaking changes

### Managing Dependencies

**Best practices:**
- Keep dependencies minimal (only what's needed)
- Use `implicitDependencies` for logical dependencies
- Avoid circular dependencies (use `shared` package for common code)
- Document dependency relationships in `project.json`

### Enforcing Boundaries

As the monorepo grows, consider enforcing boundaries:

1. **Add `@nx/eslint-plugin`**: For boundary enforcement
2. **Define tags**: Tag packages (e.g., `shared`, `backend`, `frontend`)
3. **Configure rules**: Define allowed dependencies per tag
4. **Enforce in CI**: Fail CI if boundaries are violated

## Common Anti-patterns

### 1. Overly Broad Inputs

**Anti-pattern:**
```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  }
}
```

**Problem:** Cache invalidates on any file change, even irrelevant files.

**Solution:**
```json
{
  "namedInputs": {
    "default": [
      "{projectRoot}/src/**/*",
      "!{projectRoot}/**/*.test.{ts,tsx}"
    ]
  }
}
```

### 2. Unnecessary cache: false

**Anti-pattern:**
```json
{
  "targets": {
    "build": {
      "cache": false
    }
  }
}
```

**Problem:** Loses caching benefits for no reason.

**Solution:** Only set `cache: false` when necessary (e.g., Docker builds that use BuildKit).

### 3. Missing dependsOn

**Anti-pattern:**
```json
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc"
      }
    }
  }
}
```

**Problem:** May build before dependencies are ready.

**Solution:**
```json
{
  "targets": {
    "build": {
      "dependsOn": ["^build"],
      "executor": "nx:run-commands",
      "options": {
        "command": "tsc"
      }
    }
  }
}
```

### 4. Incorrect Parallelism Settings

**Anti-pattern:**
```json
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "parallel": 100
      }
    }
  }
}
```

**Problem:** Too much parallelism causes resource contention and slower execution.

**Solution:** Use reasonable parallelism (3-5 for most machines, 5-10 for CI).

### 5. Not Using Affected Detection

**Anti-pattern:**
```bash
# Always running all tests
npm run test
```

**Problem:** Wastes time running tests for unchanged projects.

**Solution:**
```bash
# Use affected detection during development
npx nx affected --target=test

# Only run all tests before committing
npm run test
```

## Additional Resources

- **[`docs/NX_SETUP.md`](NX_SETUP.md)**: Comprehensive NX setup documentation
- **[`docs/NX_VALIDATION_CHECKLIST.md`](NX_VALIDATION_CHECKLIST.md)**: Step-by-step validation guide
- **[`README.md`](../README.md#nx-monorepo-tooling)**: Quick reference for NX commands
- **[`CONTRIBUTING.md`](../CONTRIBUTING.md#nx-monorepo-tooling)**: Development workflow with NX
- **[NX Official Docs](https://nx.dev)**: Complete NX documentation and guides
