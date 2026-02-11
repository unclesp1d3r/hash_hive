# Dashboard Stats API Endpoint (GET /api/v1/dashboard/stats)

## Overview

Add a dedicated **project-scoped** dashboard stats endpoint so the frontend can fetch a single payload for the dashboard stat cards, rather than aggregating via `/agents`, `/campaigns`, and `/tasks` client-side.

This also ensures **correctness under server-side project scoping**, per your decision.

## Scope

**In Scope:**
- Add endpoint: `GET /api/v1/dashboard/stats`
- Endpoint returns counts required for the Dashboard stat cards:
  - agents: total, online, offline, error
  - campaigns: total, active/running, paused, completed, draft (exact breakdown can match UI)
  - tasks: total, pending, running, completed, failed
  - cracked hashes: total cracked (and optional crack rate if hash list totals available cheaply)
- Enforce server-side scoping:
  - stats are computed for the user’s **selected project context**
  - do not accept `projectId` as the sole authorization/scoping input
- Add request/response validation and tests

**Out of Scope:**
- Per-agent or per-campaign analytics dashboards
- Time series stats / trend charts

## Acceptance Criteria

1. **Endpoint exists and is secured**
   - `GET /api/v1/dashboard/stats` requires a valid session
   - Returns 400 if a project context is required but missing
   - Returns 403 if the user is not a member of the selected project

2. **Correct stats payload**
   - Response contains the counts needed for the 4 stat cards described in Core Flows Flow 2
   - Counts are computed server-side with efficient aggregate queries (no N+1 loops)

3. **Project scoped**
   - All counts reflect only data in the selected project
   - No leakage across projects

4. **Frontend compatibility**
   - Payload structure is documented and stable enough to be used by the Dashboard UI ticket (the UI can switch from client-side aggregation to this endpoint)

## Implementation Notes / Guidance (non-binding)

- Current frontend computes stats client-side in `file:packages/frontend/src/hooks/use-dashboard.ts`. This endpoint should replace that aggregation once implemented.
- There is currently no `file:packages/backend/src/routes/dashboard/stats.ts`; this ticket introduces it.
- Add the route mount in `file:packages/backend/src/index.ts`.

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/cdc45e34-aa52-4943-a08d-445215e63214` (Project Selection & User Authentication API; selected project context + membership enforcement)

## Spec References

- Core Flows Flow 2 (Dashboard Monitoring): `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5`
- Tech Plan (Real-time + query invalidation model): `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16`
