# Results API & CSV Export (Dashboard Backend)

## Overview

Implement a **project-scoped Results API** and **CSV export** for cracked hashes, including **attribution** (campaign → attack → hash list) to satisfy Core Flows “Result Analysis” and the Epic Brief success criteria.

This ticket exists because there is currently **no** `/api/v1/dashboard/results` backend, and current ingestion does not reliably support attribution-required queries.

## Scope

**In Scope:**
- Add project-scoped endpoints:
  - `GET /api/v1/dashboard/results` (paginated, filterable)
  - `GET /api/v1/dashboard/results/export` (CSV export for filtered results)
- Support filters (at minimum):
  - `campaignId` (optional)
  - `hashListId` (optional)
  - `q` (optional search; hash value and/or plaintext)
  - `startDate`, `endDate` (optional date range)
  - `limit`, `offset` for pagination
- Implement **result attribution** so every cracked result can be tied to:
  - campaign
  - attack
  - hash list
  - (optionally) task and agent
- Ensure **server-side scoping**:
  - results must be constrained to the user’s selected project context (per `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/cdc45e34-aa52-4943-a08d-445215e63214`)
- Add request validation (Zod) and consistent error shapes
- Add tests (auth guard + basic filtering + export content-type)

**Out of Scope:**
- Advanced analytics (pattern mining, common password stats)
- Collaboration/sharing features
- UI changes (handled in Results UI ticket)

## Acceptance Criteria

1. **Results listing**
   - `GET /api/v1/dashboard/results` returns a paginated list of cracked results for the **selected project**
   - Each row includes (at minimum):
     - `hashValue`
     - `plaintext`
     - `crackedAt`
     - `hashListId` + hash list name (or resolvable reference)
     - `campaignId` + campaign name
     - `attackId` + attack mode (or resolvable reference)
   - Filtering works for `campaignId`, `hashListId`, date range, and `q`
   - Endpoint is protected by session auth and project membership

2. **CSV export**
   - `GET /api/v1/dashboard/results/export` returns `text/csv`
   - Export respects the same filters as the list endpoint
   - Export includes *all matching rows* (not just one page)
   - Output columns match Core Flows expectations:
     - hash_value, plaintext, campaign, attack, hash_list, cracked_at (exact names can vary but must be documented)

3. **Attribution is reliable**
   - After an agent reports cracked hashes, the system can later answer:
     - “Which campaign cracked this plaintext?”
     - “Which attack cracked it?”
     - “Which hash list did it belong to?”
   - This attribution must be queryable without ambiguous inference.

4. **Project scoping**
   - No API call may fetch results from a project the user is not a member of.
   - The API must not trust client-provided `projectId` as an authorization mechanism.

## Implementation Notes / Guidance (non-binding)

- Current schema `hash_items` (`file:packages/shared/src/db/schema.ts`) does **not** include explicit `campaignId/attackId/taskId/agentId` fields. To satisfy attribution cleanly, prefer adding explicit columns or storing a consistent attribution object in `hash_items.metadata`.
- Current ingestion path updates hash_items in `file:packages/backend/src/services/tasks.ts` (via task reports). This will likely need adjustment to:
  - set `crackedAt`
  - upsert on (`hashListId`, `hashValue`) once the unique constraint is in place (see idempotency work in Resource API ticket)
- Add a new dashboard route module, e.g. `file:packages/backend/src/routes/dashboard/results.ts`, and mount it from `file:packages/backend/src/index.ts`.

## Dependencies

- Depends on project scoping/session work:
  - `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/cdc45e34-aa52-4943-a08d-445215e63214` (Project Selection & User Authentication API)
- Strongly related to idempotent hash ingestion:
  - `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/a8087bff-4a20-47b9-ac88-496fd0819d7c` (Resource Management API: unique constraint & upsert/ignore)

## Spec References

- Epic Brief success criteria: `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/e0d240a3-52ba-42de-b4d4-95e2148d4366`
- Core Flows Flow 8 (Result Analysis): `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5`
- Tech Plan (Real-time events + attribution intent): `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16`
