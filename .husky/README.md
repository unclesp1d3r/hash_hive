# Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Available Hooks

### pre-commit

Runs automatically before each commit.

**What it does:**

- Runs `lint-staged` to check and fix only staged files
- Lints TypeScript/JavaScript files with ESLint
- Formats code with Prettier
- Automatically fixes issues when possible

**Files checked:**

- `*.{ts,tsx}` - TypeScript files (lint + format)
- `*.{js,jsx}` - JavaScript files (lint + format)
- `*.{json,md,yaml,yml}` - Config/doc files (format only)

### pre-push

Runs automatically before each push.

**What it does:**

- Runs TypeScript type checking across all workspaces
- Runs all test suites (unit + integration)
- Prevents pushing code with type errors or failing tests

## Skipping Hooks

In emergencies, you can skip hooks (not recommended):

```bash
# Skip pre-commit
git commit --no-verify

# Skip pre-push
git push --no-verify
```

## Configuration

- Hook scripts: `.husky/pre-commit`, `.husky/pre-push`
- lint-staged config: `package.json` → `lint-staged` field
- Husky setup: `package.json` → `prepare` script

## Troubleshooting

If hooks aren't running:

```bash
# Reinstall hooks
npm run prepare

# Make hooks executable
chmod +x .husky/pre-commit .husky/pre-push

# Check Git hooks are enabled
git config core.hooksPath
# Should output: .husky
```
