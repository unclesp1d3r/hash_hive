---
mode: agent
model: GPT-5 (copilot)
tools: [githubRepo, edit, search, new, runCommands, runTasks, usages, vscodeAPI, think, problems, changes, testFailure, openSimpleBrowser, fetch, extensions, todos, memory]
description: Analyze diff, apply safe internal fixes, report results
---

Analyze only the changed files (diff scope) and improve them while preserving public APIs. Focus categories: (1) Code Smells (large/duplicate/complex) (2) Design Patterns (service layer, factory, builder, repository) (3) Best Practices (TypeScript strict mode, project conventions, MERN stack patterns) (4) Readability (naming, structure, cohesion) (5) Maintainability (modularization, clarity, service layer separation) (6) Performance (async/await, MongoDB queries, Redis operations, blocking I/O) (7) Type Safety (strict TypeScript, avoid `any`, proper Zod schemas, Mongoose types) (8) Error Handling (AppError class, structured errors, no silent failures, proper logging with Pino). Context: HashHive = MERN stack, service-layer architecture, project-scoped multi-tenancy, security-first, zero-warnings, memory conscious. Prefer clear + secure over clever.

## ACTION WORKFLOW (MANDATORY)

1. Collect diff file list. 2. Analyze per focus category. 3. Classify each finding: `safe-edit` (apply now), `deferred`, `requires-approval`. 4. Auto-apply only `safe-edit` (mechanical, internal, non-breaking, warning removal, correctness, logging consistency, blocking I/O → async/await, console.log → Pino logger). 5. Run `just lint` then `just test`. On failure: isolate failing hunk, revert it, re-run, document skip. 6. Generate report (summary table, applied edits + rationale, deferred backlog, approval-needed with risks, next-step roadmap). 7. Output unified diff (never commit). If zero safe edits: state "No safe automatic edits applied" and still output full report.

## AUTO-EDIT CONSTRAINTS (STRICT)

- Scope: Only diff-related files
- Gates: Must pass `just lint` + tests
- User Control: Never commit/stage
- Public API: No signature/visibility/export changes
- Validation: Always run quality gates before reporting

## CRITICAL REQUIREMENTS

- Actionable suggestions (code examples when clearer)
- Auto-apply only clearly safe internal fixes
- Prioritize runtime correctness, safety, type rigor, security posture
- Preserve all public APIs (no signature/visibility changes)
- Avoid cleverness; optimize for clarity & maintainability

## REPO RULES (REINFORCED)

Zero warnings (ESLint) | Strict TypeScript (no `any`) | Precise typing | Async/await for I/O | Service-layer architecture | AppError for errors | Zod validation | Project-scoped multi-tenancy | Memory efficient | S3-compatible storage (MinIO) | Path validation | No secrets in logs | JSDoc for all public APIs | Pino logging (no console.log)

---

## EXECUTION CHECKLIST

1 Diff scan 2 Analyze 3 Classify 4 Safe edits applied 5 Gates pass 6 Report (summary/applied/deferred/approval-needed/roadmap) 7 Output diff. On blocker: report + remediation guidance.

## QUICK REFERENCE MATRIX

Category -> Examples of Safe Edits:

- Smells: remove dead code, split oversized internal function (no visibility change)
- Patterns: introduce small private helper or service method internally
- Best Practices: replace blocking fs in async with fs/promises or async fs operations
- Readability: rename local vars (non-public), add JSDoc comments/examples
- Maintainability: extract internal module or service method (keep public API stable)
- Performance: eliminate needless object cloning, memoize constant, bound array growth
- Type Safety: replace `string` boolean flags with small internal enum (private), add proper Zod schemas
- Error Handling: add context via AppError, convert generic string errors to structured variants if already internal

If ambiguity arises, default to: classify (deferred) instead of applying.
