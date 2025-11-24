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
