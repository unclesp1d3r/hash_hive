---
mode: agent
model: GPT-5 (copilot)
tools: [githubRepo, edit, search, new, runCommands, runTasks, usages, vscodeAPI, think, problems, changes, testFailure, openSimpleBrowser, fetch, extensions, todos, memory]
description: Analyze diff for security posture, apply safe internal hardening edits, produce report
---

Analyze ONLY changed files (diff scope) for security posture and apply clearly safe hardening improvements while preserving all public APIs.

## FOCUS CATEGORIES

01. Authentication & Authorization (JWT validation, session security, role-based access control, project-scoped access)
02. Input Validation & Parsing (config, API requests, paths, MongoDB queries) – reject invalid early, no silent defaults, Zod schemas
03. Data Handling & Storage (no secrets logged, path validation, S3-compatible storage usage, no binary blobs in MongoDB)
04. Cryptography & Integrity (correct password hashing usage, future-proof abstractions, no insecure algorithms, JWT signing)
05. API & Concurrency Safety (rate limiting, timeouts, request validation, CORS configuration)
06. Error Handling & Logging Hygiene (no sensitive leakage, structured context, no console.log for operational info, use Pino logger)
07. Dependency & Surface Minimization (avoid unnecessary packages/features, dead code removal, npm audit)
08. Defense-in-Depth Opportunities (rate limiting, input sanitization, bounds checking, resource ceilings, MongoDB injection prevention)
09. Security Regression Risks (stubs flagged, TODOs categorized, unimplemented sections clearly documented, security headers)
10. Supply Chain & Build Hygiene (npm audit, ESLint security rules, dependency updates, no eval/Function constructors)

## ACTION WORKFLOW (MANDATORY)

1 Diff list → 2 Security analysis per category → 3 Classify findings (`safe-edit` / `deferred` / `requires-approval`) → 4 Apply only mechanical non-breaking hardening edits (logging normalization, path validation + bound checks, converting console.log/console.error to Pino logger, adding missing Zod validation, adding missing error context) → 5 Run `just lint` & `just test` → 6 Revert any failing hunk → 7 Report (summary, applied, deferred, approval-needed, risk notes, roadmap) → 8 Output unified diff (no commit).

If zero safe edits: state "No safe security edits applied" and still emit full report.

## SAFE HARDENING EDIT EXAMPLES

- Replace `console.log/console.error` with Pino logger (`logger.info/warn/error`)
- Add request validation middleware with Zod schemas to sensitive endpoints
- Inline guard clauses for obvious errors or unchecked access (if internal)
- Validate and sanitize paths, verify they're within allowed boundaries
- Remove dead code exposing potential attack surface
- Strengthen error messages (no raw system paths, secrets, or sensitive data in errors)
- Add length / size / iteration bounds for unbounded growth structures
- Replace stringly-typed mode flags with private enums or const objects
- Ensure all public API doc comments mention security considerations where relevant
- Add input sanitization for user-provided data before MongoDB queries
- Ensure JWT tokens are properly validated and not logged

## AUTO-EDIT CONSTRAINTS (STRICT)

Scope: diff-only | Gates: `just lint` + tests must pass | No commits | No public signature/visibility changes | Validate after edits

## CRITICAL REQUIREMENTS

- Preserve functional behavior while reducing risk
- No new dependencies unless strictly necessary for safety
- Avoid speculative rewrites—minimal surface change
- Avoid perf regressions; if added checks are non-trivial mark as deferred
- Do not mask existing errors—surface with context instead

## REPO RULES (REINFORCED)

Zero warnings (ESLint) | Strict TypeScript (no `any`) | Precise typing | Async/await for I/O | Service-layer architecture | AppError for errors | Zod validation | Project-scoped multi-tenancy | Memory efficiency | S3-compatible storage (MinIO) | Path validation | No secrets in logs | JSDoc for public APIs | Pino logging

## EXECUTION CHECKLIST

1 Diff scan 2 Analyze security 3 Classify 4 Apply safe hardening edits 5 Gates pass 6 Report 7 Output diff | On blocker: report with remediation.

## QUICK SECURITY MATRIX

Category → Sample Safe Edit:

- Authentication/Authorization → Add missing role check in route handler
- Input Validation → Add Zod schema validation before processing
- Data Handling → Validate + ensure path within allowed boundaries
- Cryptography → Ensure password hashing uses bcrypt/argon2 with proper salt rounds
- API/Concurrency → Add rate limiting middleware, timeout constants
- Logging → Replace raw error chain with redacted display (no secrets)
- Resource Bounds → Add comment + bound to array growth pattern
- Stub Sections → Mark with `SECURITY_TODO:` prefix for tracking
- MongoDB → Ensure queries use parameterized inputs, not string interpolation

Ambiguous? Defer and document.
