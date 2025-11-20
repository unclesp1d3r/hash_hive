# CipherSwarm MERN Reimplementation Proposal

## REASONING

CipherSwarm is currently implemented as a Rails 8 monolith backed by PostgreSQL and Redis, with a V2 upgrade plan that assumes a FastAPI + SvelteKit architecture for future work. This document proposes an alternative path: a full reimplementation of CipherSwarm on a MERN stack (MongoDB, Express, React, Node.js) while preserving CipherSwarm’s domain model, workflows, and operational assumptions.

### Alternatives Considered

1. **Stay on Rails 8 (Status Quo + Iterative Refactors)**

   - **Pros**
     - Mature, battle-tested framework and ecosystem
     - Existing code, tests, and documentation remain directly usable
     - Minimal risk around domain logic regression
   - **Cons**
     - Ruby-only skill requirement for contributors
     - Less alignment with JavaScript-based modern frontend ecosystems
     - Harder to share validation/runtime types between API and frontend

2. **FastAPI + SvelteKit (Existing V2 Plan)**

   - **Pros**
     - Strong typed data modeling via Pydantic
     - Excellent async story and rich Python ecosystem
     - V2 implementation documents already describe much of the target behavior
   - **Cons**
     - Two-language stack (Python + TypeScript) with duplicated types
     - Requires full replatforming and reimplementation effort similar in magnitude to MERN

3. **MERN Stack (MongoDB + Express + React + Node.js) – Chosen**

   - **Pros**
     - Single-language stack (TypeScript) across backend and frontend
     - Shared types between models, DTOs, and React components
     - Large hiring pool and ecosystem for Node + React
     - Natural fit for JSON-centric APIs, event streams, and real-time dashboards
   - **Cons**
     - Loss of Rails conventions and tooling (ActiveRecord, RSpec, ViewComponent)
     - Requires careful design of data modeling and consistency guarantees in MongoDB

**Decision:** Proceed with a greenfield MERN implementation that **reuses CipherSwarm’s domain model and V2 functional design** but expresses it in a Node/Express + MongoDB backend and a React (with Next.js) frontend. The MERN implementation defines **new internal and external contracts** where needed; the legacy Rails system is used only as a behavioral reference during development, with data moved via one-time or repeatable migration scripts.

---

## 1. Objectives

- Preserve CipherSwarm’s **core capabilities**:
  - Agent management and monitoring
  - Campaigns, attacks, and task distribution
  - Resource management (hash lists, wordlists, masklists, rulelists)
  - Project-based multi-tenancy and RBAC
- Deliver a **modern, type-safe MERN implementation**:
  - TypeScript everywhere (backend + frontend)
  - Well-defined JSON APIs and schemas
- Define the **Agent API** using an explicit OpenAPI specification (YAML/JSON) that is the source of truth for agent-facing endpoints.
- Provide a **scripting and automation API** that exposes RESTful endpoints suitable for integration with n8n, MCP-based tools, and other HTTP-first automation platforms.
- Support **real-time operations**:
  - Live dashboards for agents, campaigns, attacks, and tasks
  - Streaming crack results and status events
- Maintain **operational assumptions**:
  - LAN-connected, trusted agents
  - Single-tenant or project-scoped multi-tenant deployments
- Provide robust **migration tooling** (one-time and repeatable scripts) to move data from the legacy PostgreSQL schema into MongoDB; no runtime compatibility or shared-schema operation between Rails and MERN is required.

---

## 2. Current System Overview (Rails Reference)

CipherSwarm today is a Rails 8 monolith with:

- **Domain Models (ActiveRecord)**: `User`, `Project`, `ProjectUser`, `Role`, `Agent`, `AgentError`, `OperatingSystem`, `Campaign`, `Attack`, `Task`, `HashList`, `HashItem`, `HashType`, `WordList`, `RuleList`, `MaskList`, `HashcatStatus`, `HashcatBenchmark`, `HashcatGuess`, `AdvancedConfiguration`, `DeviceStatus`.
- **Web UI**: Rails controllers + views, ViewComponents, Hotwire for interactivity.
- **APIs**:
  - `app/controllers/api/v1/client/*` – Agent API (authentication, task fetch/submit, status updates, error reporting).
  - Admin / web controllers for human operators.
- **Infrastructure**:
  - PostgreSQL 17+ for relational data
  - Redis 7.2+ for caching and Sidekiq job queues
  - Background jobs for hash list processing, status updates, mask complexity, etc.

The existing V2 docs already define a rich target behavior (agent API, web API, control API, save/load templates, task distribution, crackable uploads). This proposal **reuses those behavioral contracts** and remaps them into a MERN architecture.

---

## 3. Target MERN Architecture

### 3.1 High-Level Overview

- **Frontend**: React + Next.js (TypeScript), Tailwind CSS, component library (shadcn/ui for React) for the operator-facing web UI.
- **Backend**: Node.js (TypeScript) + Express (or Fastify) REST API server with structured routing and middleware.
- **Database**: MongoDB for primary data storage. Collections for each major domain concept with compound indexes for query patterns.
- **Caching & Jobs**: Redis + BullMQ (or similar) for message-queue-based job orchestration, scheduled tasks, and transient state.
- **Agents**: Existing CipherSwarm agents (or future reimplemented agents) communicate over a JSON HTTP API (or HTTP + SSE) exposed by the Node backend.
- **Observability**: Centralized structured logging, metrics, and tracing (e.g., pino + OpenTelemetry-compatible exporters).

### 3.2 Service Boundaries

Logical modules in the Node backend:

- **Auth & Identity Service**: Users, roles, sessions, tokens, project membership.
- **Project & RBAC Service**: Multi-project management, role assignments, permission checks.
- **Agent Service**: Agent registration, heartbeat, capabilities, device status, error reporting.
- **Campaign & Attack Service**: Campaign orchestration, attack definitions, templates, DAG-style dependencies.
- **Task Distribution Service**: Task queueing, agent assignment, keyspace partitioning, progress tracking.
- **Resource Service**: Hash lists, hash items, wordlists, rulelists, masklists, uploads, metadata, object storage (e.g., S3/MinIO via Node SDK).
- **Hash Analysis Service**: Hash type guessing and validation, mapping to hashcat modes.
- **Event & Notification Service**: Real-time event streams via WebSockets/SSE for dashboards and log-style views.

Each service is implemented as a cohesive module (routes, controllers/handlers, service layer, data access layer, schemas/types, tests).

---

## 4. Domain Model Mapping (Rails → MongoDB)

MongoDB provides flexible schemas but must be constrained with explicit TypeScript types and validation. We adopt **Mongoose** or a similar ODM plus **zod** for API-level DTO validation.

### 4.1 Identity & Access

- `users` collection
  - Fields: `_id`, `email`, `password_hash`, `name`, `status`, `last_login_at`, audit fields.
  - Indexes: unique email, compound `{ status, project_ids }` as needed.
- `projects` collection
  - Fields: `_id`, `name`, `description`, `slug`, `settings`, audit fields.
- `project_users` collection (or embed in users/projects depending on query patterns)
  - Fields: `user_id`, `project_id`, `roles[]`.
- `roles` collection
  - Defines global or project-scoped roles (admin, operator, analyst, agent_owner, etc.).

### 4.2 Agents & Operating Systems

- `operating_systems`
  - Static or semi-static catalog used by agent capabilities.
- `agents`
  - Fields: `_id`, `name`, `project_id`, `operating_system_id`, `auth_token`, `status`, `capabilities`, `last_seen_at`, `hardware_profile`, `current_task_id`.
  - Indexes: `{ project_id, status }`, `auth_token`.
- `agent_errors`
  - Fields: `_id`, `agent_id`, `occurred_at`, `severity`, `message`, `context` (structured JSON), `task_id` (optional).

### 4.3 Campaigns, Attacks, Tasks

- `campaigns`
  - Fields: `_id`, `project_id`, `name`, `description`, `hash_list_id`, `status`, `priority`, `metadata`, `created_by`, `timeline`.
- `attacks`
  - Fields: `_id`, `campaign_id`, `project_id`, `mode`, `hash_type_id`, `wordlist_ref`, `rulelist_ref`, `masklist_ref`, `advanced_configuration`, `keyspace`, `status`, `dependencies`, `template_id (optional)`.
- `tasks`
  - Fields: `_id`, `attack_id`, `campaign_id`, `agent_id (nullable)`, `status`, `work_range`, `progress`, `result_stats`, `assigned_at`, `started_at`, `completed_at`, `failure_reason`.
  - Indexes: `{ status, agent_id }`, `{ attack_id, status }`.

### 4.4 Resources & Hash Data

- `hash_lists`
  - Fields: `_id`, `project_id`, `name`, `hash_type_id`, `source`, `file_ref`, `statistics`, `status`.
- `hash_items`
  - Fields: `_id`, `hash_list_id`, `hash_value`, `plaintext (optional)`, `cracked_at`, `metadata`.
  - Index: `{ hash_list_id, cracked_at }`.
- `hash_types`
  - Catalog of supported hashcat modes.
- `word_lists`, `rule_lists`, `mask_lists`
  - Fields: `_id`, `project_id`, `name`, `description`, `file_ref`, `size`, `hashcat_flags`, `guid`.

### 4.5 Status, Metrics, and Events

- `hashcat_statuses`, `hashcat_benchmarks`, `hashcat_guesses` can be modeled as:
  - Time-series collections with TTL or capped collections
  - Aggregated summaries persisted for dashboards.

---

## 5. Backend Design (Node.js + Express)

### 5.1 Technology Choices

- **Runtime**: Node.js LTS (TypeScript-first)
- **Framework**: Express or Fastify with modular routers per domain
- **ORM/ODM**: Mongoose for MongoDB models, plus TypeScript types
- **Validation**: zod for request/response schemas
- **Auth**:
  - JWT-based stateless auth for APIs
  - HttpOnly session cookies for web session flows (Next.js integration)
- **Queues & Scheduling**: BullMQ + Redis for background jobs
- **Configuration**: `dotenv` + centralized config module; 12-factor friendly
- **Testing**: Jest + supertest for HTTP tests; integration tests spin up MongoDB & Redis via Testcontainers

### 5.2 API Surface (High-Level)

Base URL: `/api/v1`.

- **Auth**

  - `POST /auth/login` – user login, returns session cookie/JWT
  - `POST /auth/logout`
  - `GET /auth/me` – current user profile & project memberships

- **Projects & Users**

  - `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`
  - `GET /projects/:id/users`, `POST /projects/:id/users`, `PATCH /projects/:id/users/:userId`

- **Agents (Agent API & UI)**

  - Agent API (token-based, **fully described in OpenAPI**):
    - `POST /agent/sessions` – agent authenticate/handshake
    - `POST /agent/heartbeat` – status, capabilities, device info
    - `POST /agent/tasks/next` – pull next task for agent
    - `POST /agent/tasks/:id/report` – report progress/completion/errors
  - Web UI:
    - `GET /agents`, `GET /agents/:id`, `PATCH /agents/:id`, etc.

- **Campaigns & Attacks**

  - `GET /campaigns`, `POST /campaigns`, `GET /campaigns/:id`, `PATCH /campaigns/:id`
  - `POST /campaigns/:id/start`, `POST /campaigns/:id/pause`, `POST /campaigns/:id/stop`
  - `GET /campaigns/:id/attacks`, `POST /campaigns/:id/attacks`, etc.

- **Tasks**

  - `GET /attacks/:id/tasks`
  - Administrative controls (requeue, cancel, retry) via `/tasks/:id/*` endpoints.

- **Resources**

  - `GET /resources/hash-lists`, `POST /resources/hash-lists`
  - `POST /resources/hash-lists/:id/import` – parse uploaded hashes
  - `GET /resources/word-lists`, `POST /resources/word-lists` (file uploads)
  - Similar endpoints for rulelists and masklists.

- **Hash Analysis**

  - `POST /hashes/guess-type` – input: blob of hash-like content, output: candidate hash types with confidence scores.

- **Events & Dashboards**

  - `GET /events/stream` – SSE or WebSocket upgrade endpoint for live updates
  - Event types: agent_status, campaign_status, attack_status, task_update, crack_result, system_alert.

### 5.3 Agent API & OpenAPI Specification

- The Agent API will be defined in a dedicated OpenAPI document (e.g., `openapi/agent-api.yaml`) that includes:
  - All agent-facing paths (`/agent/sessions`, `/agent/heartbeat`, `/agent/tasks/*`).
  - Request/response schemas for authentication, capabilities, task descriptors, progress reports, and error payloads.
  - Standardized error codes and retry semantics.
- The OpenAPI spec is the **single source of truth** for the Agent API and is used to:
  - Generate TypeScript types and API clients for internal use (e.g., test harnesses, simulators).
  - Generate language-specific client stubs or documentation for agent implementations in other languages.
  - Drive automated contract tests that verify the Express handlers conform to the documented schema.
- **Hashcat 7+ expansion path**:
  - Agent handshake payloads include the installed hashcat version and capability flags.
  - Task descriptors support optional fields for newer hashcat 7+ features (e.g., advanced checkpointing, new attack modes, richer status channels) that older agents can safely ignore.
  - This enables rolling upgrades where newer agents immediately benefit from hashcat 7+ capabilities while older agents continue to operate against a reduced feature set.
- Versioning strategy:
  - Semantic versioning of the Agent API (`x-agent-api-version` header and spec version field).
  - Backwards-incompatible changes are introduced under a new versioned path (e.g., `/api/v2/agent`) with a corresponding OpenAPI document.

### 5.4 Task Distribution & Job System (Message Queue Oriented)

- Dedicated **Task Distribution Service** module built around a message-queue abstraction:
  - Generates tasks based on attack definitions and hashcat keyspace calculations.
  - Enqueues `pending` tasks into Redis/BullMQ queues, keyed by campaign/attack and optionally agent capability tags (e.g., GPU/CPU profiles, supported hash modes).
  - Supports delayed, retried, and prioritized jobs via queue semantics.
- Queue topology:
  - **Global pending queues** per attack/campaign for generic work.
  - Optional **capability-specific queues** for high-value or specialized tasks (e.g., agents with certain GPU features or hashcat 7+ capabilities).
  - **Dead-letter queues** for failed tasks requiring operator intervention.
- Agent coordination model:
  - Agents periodically call `POST /agent/tasks/next` with their capabilities.
  - The Task Distribution Service inspects the relevant queues (global and capability-specific), pops the next appropriate job, marks it as `assigned`, and returns it to the agent.
  - Agents report status & completion; the service acknowledges completion in the queue backend, updates MongoDB, and emits events for dashboards via the event stream.
- This MQ-centric design mirrors CipherSwarm’s job/task semantics but leverages durable, observable queues for resilience, backpressure handling, and operational introspection (queue depths, retry counts, etc.).

### 5.5 Storage & Binary Artifacts

- Use S3-compatible object storage (MinIO in development) for large files:
  - Hash lists, wordlists, rulelists, masklists, crackable uploads.
- MongoDB stores **metadata and references only** (bucket + key), not large blobs.
- Node backend wraps object storage in a `StorageService` with unified interface.

### 5.6 Scripting & Automation Integration (REST, n8n, MCP)

- **RESTful Control API**
  - Expose a dedicated control surface (e.g., `/api/v1/control/*`) for automation-friendly operations: campaign creation, attack management, resource import/export, and status queries.
  - Use consistent REST semantics (resource-oriented URIs, standard HTTP methods, clear status codes, idempotent `PUT`/`DELETE` where applicable).
  - Share core schemas with the web UI and Agent API to avoid drift.
- **n8n Integration**
  - Ensure the RESTful Control API and Agent API are fully described in OpenAPI specs so n8n can consume them directly.
  - Design endpoints with predictable request/response shapes and authentication headers to simplify creation of custom n8n nodes and workflows.
  - Provide webhook-style endpoints (e.g., for event notifications) that n8n can subscribe to for trigger-based flows.
- **MCP (Model Context Protocol) Tooling**
  - Design a thin MCP layer that wraps the RESTful Control API as tools (e.g., `list_campaigns`, `create_attack`, `get_agent_status`, `trigger_campaign_run`).
  - Prefer small, composable operations with clear input/output JSON schemas that align with MCP tool definitions.
  - Keep all MCP tools stateless and idempotent where practical, so they can be safely retried by automation clients.
- **General Scripting Guarantees**
  - All scripting/automation endpoints use the same auth model as the web UI (tokens/roles/projects) so permissions are centralized.
  - Responses include stable identifiers and pagination/ filtering conventions that make them easy to script against.

---

## 6. Frontend Design (React + Next.js, V2-Aligned UI)

### 6.1 Technology Choices

- **Framework**: Next.js (React, TypeScript) for SSR/SSG hybrid
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui (React)
- **Forms & Validation**: React Hook Form + Zod
- **Data Fetching**: React Query (TanStack Query) for API integration and caching
- **Routing**: App Router with server components where appropriate
- **State Management**: Minimal global state; prefer React Query and local component state.

### 6.2 Major UI Areas (Aligned with V2 Web UI Proposal)

- **Authentication & User Profile**

  - Login, logout, password management, user profile pages.
  - Project switcher and role-aware navigation, mirroring the V2 design.

- **Operations Dashboard**

  - Global overview of agents, campaigns, attacks, and recent crack results.
  - Real-time tiles using WebSockets/SSE subscriptions.
  - Status summaries and trend charts consistent with the V2 dashboard concepts.

- **Campaigns & Attacks**

  - List, detail, and wizard-style creation/editing flows for campaigns and attacks.
  - Visual DAG or stepped workflow for attack sequences, matching V2’s guided campaign management.
  - Inline validation and keyspace/ETA estimates derived from the backend.

- **Agents**

  - Agent list with filters by status and project.
  - Agent detail: hardware info, current task, recent errors, performance history, and hash rate metrics.
  - Controls for enabling/disabling agents, setting priorities, and viewing recent errors.

- **Resources**

  - Resource browser with tabs for hash lists, wordlists, rulelists, masklists.
  - Upload & validation flows, preview of stats, linkage to campaigns/attacks.
  - Crackable uploads and hash-type guessing workflows as described in the V2 proposal.

- **Admin / Settings**

  - User & role management, project configuration, global settings.
  - Feature flags and environment/status indicators for operators.

### 6.3 Real-Time UX

- `EventContext` / hooks to subscribe to server events
- Unified event payload schema consumed by dashboards & logs
- Graceful degradation when real-time channel is unavailable (fall back to polling).

### 6.4 Testing

- **Unit & Integration**: Jest + React Testing Library
- **E2E**: Playwright or Cypress hitting the Next.js app + Node API
- CI pipeline runs headless browser tests for all major user journeys.

---

## 7. Testing & Quality Strategy

- **Backend**

  - Unit tests for services and utilities
  - API contract tests (Jest + supertest) for each route group
  - Integration tests with Testcontainers for MongoDB, Redis, MinIO

- **Frontend**

  - Component tests for critical UI components
  - Route-level tests for load functions and forms
  - E2E for end-to-end workflows: agent setup, campaign creation, attack execution, results review

- **Cross-Cutting**

  - Schema tests to ensure API DTOs align with UI expectations
  - Load/performance tests for task distribution and high agent counts

---

## 8. Migration & Rollout Strategy

The migration strategy assumes **no strict backward-compatibility requirements** at the API or database level. Functional parity with the current CipherSwarm feature set is required, but APIs, payloads, and internal data models may change as long as all operator and agent workflows are preserved.

### 8.1 Data Migration

- Define mapping scripts from PostgreSQL schemas to MongoDB collections:
  - Export relational data from Rails into neutral interchange formats (e.g., NDJSON/CSV/Parquet per table or logical entity).
  - Transform into MongoDB documents, applying any necessary **schema normalization or denormalization** for the new document model.
  - Generate new identifiers where appropriate; preserve legacy IDs only when they simplify traceability.
- Provide **idempotent migration jobs** that can be re-run safely in staging and pre-production environments.
- Validate migrated data via:
  - Row/record counts per logical entity.
  - Spot checks of critical entities (projects, users, agents, campaigns, attacks, tasks).
  - Synthetic integration tests that replay representative workflows against migrated data.

### 8.2 Cutover Options (Without Runtime Compatibility)

Two primary strategies are supported, both relying on offline or near-offline data migration instead of dual-write or shared-schema operation:

- **Big-Bang Cutover**

  - Schedule a maintenance window.
  - Put the Rails system into read-only or fully offline mode.
  - Run data export and transformation scripts.
  - Import into MongoDB and run verification checks.
  - Start MERN services (API + web UI) and reconfigure agents to point at the new Agent API.
  - Roll back by re-enabling Rails and discarding the MERN environment if acceptance checks fail.

- **Shadow Environment with Final Cutover**

  - Stand up a full MERN environment using a **snapshot** of production data.
  - Perform validation, load testing, and UAT against the MERN stack.
  - Shortly before go-live, repeat the export/transform/import process with a fresh snapshot.
  - Decommission or archive Rails after a fixed confidence period.

There is **no requirement** to maintain HTTP-level or database-level compatibility between Rails and MERN during this process; agents and operator tooling can be updated to speak the new API contracts at cutover time.

### 8.3 Agent & Client Migration

- Implement a **new Agent API contract** under a clear version (e.g., `v2`), defined exclusively by the MERN backend.
- Provide updated agent binaries or configuration that target the MERN Agent API endpoints.
- Migration path:
  - Update agent configuration management to roll out new URLs and authentication tokens.
  - Optionally support a short-lived compatibility shim that proxies old agent calls to the new backend, but this is not required.
  - Decommission legacy agent endpoints once all agents are upgraded.

### 8.4 Operator Workflow Validation

- For each major workflow (campaign creation, attack orchestration, hashlist import, resource management, monitoring, reporting):
  - Document the functional expectations based on the current Rails implementation.
  - Write explicit test plans (E2E tests + manual checklists) to validate MERN behavior against those expectations.
  - Use these plans as acceptance criteria for final cutover.

### 8.5 Operational Readiness

- Docker images for:
  - `cipherswarm-api` (Node + Express)
  - `cipherswarm-web` (Next.js)
  - `mongo`, `redis`, `minio`
- Compose or Kubernetes manifests for local and production deployments.
- Logging, metrics, and alerting integrated before production cutover.

---

## 9. Implementation Phases (MERN-Specific)

1. **Foundation**

   - Scaffold Node/Express API and Next.js app
   - Integrate MongoDB, Redis, and MinIO
   - Establish TypeScript configuration, linting, formatting, test harnesses

2. **Identity & Projects**

   - Implement users, projects, roles, session management
   - Build basic admin UI and authentication flows

3. **Agents & Resources**

   - Implement Agent API endpoints and models
   - Implement resource management (hash lists, wordlists, rulelists, masklists) and UI

4. **Campaigns, Attacks, Tasks**

   - Implement campaign/attack/task domain
   - Implement task distribution service & queues
   - Build dashboards and editors in React

5. **Real-Time Events & Analytics**

   - Implement event bus and WebSockets/SSE endpoints
   - Wire UI dashboards and logs to live feeds

6. **Hardening & Cutover**

   - Load testing, failure scenario testing, and resilience checks
   - Final data migration and switch agents & users to MERN stack
   - Decommission or archive Rails implementation after stable period.

---

## 10. Risks, Trade-offs, and Open Questions

- **MongoDB vs Relational Semantics**
  - Need careful modeling for relationships (campaigns ↔ attacks ↔ tasks, projects ↔ users ↔ roles) to avoid data anomalies.
- **Agent Migration**
  - Existing agents may require new binaries or configuration to speak the MERN-defined Agent API; plan for staggered rollout and clear versioning rather than protocol-level backward compatibility.
- **Operational Complexity**
  - MERN introduces multiple moving parts (Node API, Next.js frontend, Mongo, Redis, MinIO). Deployment automation and observability must be first-class.
- **Migration Blast Radius**
  - A big-bang cutover is risky; phased, feature-based migration with clear rollback paths is preferred.

This proposal provides a high-level blueprint for a MERN-based CipherSwarm implementation. Detailed API contracts, data schemas, and migration scripts should be maintained in separate, focused design documents as the implementation proceeds.
