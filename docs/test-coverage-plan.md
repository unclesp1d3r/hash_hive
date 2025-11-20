# Test Coverage Improvement Plan

## Overview

This document tracks the path to achieving 80% branch coverage across the HashHive backend codebase. The global target is 80% for all metrics (branches, functions, lines, statements), with temporary per-file overrides for areas requiring additional test development.

## Current Status (as of 2025-11-19)

**Global Coverage:**

- Statements: 83.33% ✅
- Functions: 91.66% ✅
- Lines: 82.75% ✅
- Branches: 53.84% ⚠️

## Files Below 80% Branch Coverage

### 1. `src/config/index.ts` (33.33% branches)

**Current Override:** 35%
**Target:** 80%
**Uncovered Lines:** 61-68

**Missing Coverage:**

- Environment-specific configuration branches (development vs production)
- Configuration validation error paths
- Optional environment variable handling

**Action Items:**

- Add unit tests for config module with different NODE_ENV values
- Test missing/invalid environment variable scenarios
- Test default value fallbacks

**Timeline:** Before adding database/Redis configuration (Task 2.2)

---

### 2. `src/middleware/error-handler.ts` (40% branches)

**Current Override:** 45%
**Target:** 80%
**Uncovered Lines:** 106-117, 122-132, 136-146

**Missing Coverage:**

- ZodError formatting and response structure
- AppError with different error codes and status codes
- Generic Error handling paths
- Production vs development error detail exposure

**Action Items:**

- Expand middleware tests to cover all error types (ZodError, AppError, generic Error)
- Test error responses in both development and production modes
- Verify error logging for each error type
- Test edge cases (errors without messages, errors with circular references)

**Timeline:** Before Campaign Service implementation (Task 3.3)

---

### 3. `src/routes/health.ts` (50% branches)

**Current Override:** 50%
**Target:** 80%
**Uncovered Line:** 20

**Missing Coverage:**

- Likely a conditional branch in one of the health check endpoints
- May involve database/Redis connection checks once implemented

**Action Items:**

- Review line 20 to identify the uncovered branch
- Add test case for the missing condition
- Once database/Redis are added, test health checks with connection failures

**Timeline:** Immediate (simple fix) + revisit after database integration (Task 2.2)

---

## Incremental Improvement Strategy

### Phase 1: Foundation (Current Sprint)

- ✅ Establish 80% global target with per-file overrides
- 🔄 Document coverage gaps and improvement plan
- 🔄 Fix `routes/health.ts` to reach 80% branches

### Phase 2: Core Infrastructure (Before Task 2.2)

- Improve `config/index.ts` to 80% branches
- Add comprehensive config validation tests
- Test environment-specific behavior

### Phase 3: Error Handling (Before Task 3.3)

- Improve `middleware/error-handler.ts` to 80% branches
- Cover all error types and response formats
- Test production vs development error exposure

### Phase 4: Ongoing (All Future Tasks)

- All new code must meet 80% branch coverage
- No new per-file overrides without documented justification
- Remove per-file overrides as coverage improves

---

## Monitoring and Enforcement

- Coverage reports run on every test execution
- CI/CD pipeline enforces coverage thresholds
- Per-file overrides are temporary and should be removed as tests are added
- Any new per-file override requires:
  1. Update to this document with justification
  2. Action items and timeline
  3. Approval in code review

---

## Notes

- The `src/index.ts` file is excluded from coverage as it contains server startup code that's not executed in tests
- Integration tests contribute to coverage but focus on API contract validation
- Unit tests should target specific branches and edge cases
