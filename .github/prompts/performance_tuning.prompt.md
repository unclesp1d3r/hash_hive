---
mode: agent
model: GPT-5 (copilot)
tools: [githubRepo, edit, search, new, runCommands, runTasks, usages, vscodeAPI, think, problems, changes, testFailure, openSimpleBrowser, fetch, extensions, todos, memory]
description: Analyze diff for performance, apply safe micro-optimizations, produce report
---

Analyze ONLY changed files (diff scope) for runtime performance characteristics while preserving correctness, public APIs, and security constraints. Apply only clearly safe micro-optimizations.

## FOCUS CATEGORIES

01. Next.js Rendering (SSR vs SSG vs ISR selection, unnecessary client-side rendering, image optimization, dynamic imports)
02. React Component Optimization (unnecessary re-renders, missing memo/useMemo/useCallback, component splitting, hook dependencies)
03. MongoDB Query Efficiency (missing indexes, N+1 queries, inefficient aggregation pipelines, projection usage, query selectivity)
04. BullMQ Job Management (job batching, queue configuration, job priority, concurrency limits, job retry strategies)
05. Data Fetching Patterns (React Query cache configuration, stale-while-revalidate, request deduplication, parallel queries)
06. Bundle Size & Code Splitting (dynamic imports, route-based splitting, tree-shaking opportunities, large dependencies)
07. Memory & State Management (memory leaks in effects, unnecessary state updates, large object retention, cleanup functions)
08. Async & Concurrency (blocking operations, unnecessary awaits, Promise.all patterns, parallel data fetching)
09. Caching Strategies (React Query cache keys, Next.js cache headers, Redis caching opportunities, memoization)
10. I/O & Network Efficiency (redundant API calls, request batching, streaming responses, connection pooling)

## ACTION WORKFLOW (MANDATORY)

1 Diff list → 2 Perf analysis per category → 3 Classify (`safe-edit` / `deferred` / `requires-approval`) → 4 Apply only mechanical, behavior-preserving micro-optimizations (e.g., add React.memo, add MongoDB index, convert to server component, batch BullMQ jobs) → 5 Run `just lint` & `just test` → 6 Revert failing hunk if gates fail → 7 Report (summary, applied, deferred, approval-needed, perf notes, next steps) → 8 Output unified diff (no commit).

If zero safe edits: state "No safe performance edits applied" and still produce full report.

## SAFE PERFORMANCE EDIT EXAMPLES

### Next.js

- Convert client components to server components where possible
- Add `next/image` optimization instead of regular `<img>` tags
- Use dynamic imports (`next/dynamic`) for heavy components
- Add `generateStaticParams` for static route generation
- Implement ISR with appropriate `revalidate` values
- Use `unstable_cache` for server-side data caching

### React

- Add `React.memo` to prevent unnecessary re-renders of expensive components
- Wrap callbacks in `useCallback` to prevent child re-renders
- Wrap expensive computations in `useMemo`
- Fix missing dependencies in `useEffect`/`useCallback`/`useMemo` hooks
- Split large components into smaller, memoized components
- Remove unnecessary state updates or combine related state

### MongoDB

- Add indexes for frequently queried fields (especially in `find`, `sort`, `aggregate`)
- Use projection to limit returned fields (`select` in Mongoose)
- Replace N+1 queries with `$lookup` aggregations or `populate` with proper select
- Add compound indexes for multi-field queries
- Use `lean()` for read-only queries to return plain objects
- Optimize aggregation pipelines (early `$match`, limit `$project` fields)

### BullMQ

- Batch related jobs into single job with array payload
- Configure appropriate concurrency limits per queue
- Use job priorities for important tasks
- Implement job batching with `addBulk` instead of multiple `add` calls
- Configure appropriate retry strategies (delays, max attempts)
- Use job options (removeOnComplete, removeOnFail) to manage queue size

### General

- Replace sequential awaits with `Promise.all` for parallel operations
- Use React Query's `useQueries` for parallel data fetching
- Add request deduplication with React Query cache keys
- Implement proper cleanup in `useEffect` to prevent memory leaks
- Use dynamic imports for code splitting (`React.lazy`, `next/dynamic`)

## AUTO-EDIT CONSTRAINTS (STRICT)

Scope: diff-only | Gates: `just lint` + tests must pass | No commits | No public signature/visibility changes | Validate after edits | No semantic changes

## CRITICAL REQUIREMENTS

- Do not trade readability or security for micro perf
- Never introduce unsafe
- Provide benchmarks only as recommendations (do not add heavy harness automatically)
- Defer structural refactors (module splits) unless trivial & internal
- Avoid premature caching introducing invalidation complexity

## REPO RULES (REINFORCED)

Zero warnings (ESLint) | Strict TypeScript (no `any`) | Precise typing | Async/await for I/O | Service-layer architecture | AppError for errors | Zod validation | Project-scoped multi-tenancy | Memory efficiency | S3-compatible storage (MinIO) | Path validation | No secrets in logs | JSDoc for public APIs | Pino logging

## EXECUTION CHECKLIST

1 Diff scan 2 Analyze perf 3 Classify 4 Apply safe micro-optimizations 5 Gates pass 6 Report 7 Output diff | On blocker: report & remediate guidance.

## QUICK PERFORMANCE MATRIX

Category → Sample Safe Edit:

- Next.js Rendering → Convert `'use client'` component to server component, add `next/image`, use `dynamic` import
- React Optimization → Add `React.memo` to expensive component, wrap callback in `useCallback`, wrap computation in `useMemo`
- MongoDB Queries → Add index for `find().sort()` field, use `lean()` for read-only, add projection to limit fields
- BullMQ Jobs → Batch jobs with `addBulk`, configure concurrency limits, use job priorities
- Data Fetching → Use `Promise.all` for parallel queries, configure React Query `staleTime`, deduplicate requests
- Bundle Size → Add `next/dynamic` for heavy components, use `React.lazy` for route splitting
- Memory Leaks → Add cleanup function to `useEffect`, remove event listeners, cancel subscriptions
- Async Patterns → Replace sequential `await` with `Promise.all`, use `useQueries` for parallel fetching
- Caching → Configure React Query cache keys, add Next.js `unstable_cache`, implement Redis caching
- I/O Efficiency → Batch MongoDB queries, use aggregation pipelines, optimize Redis operations

Ambiguous? Defer and document.
