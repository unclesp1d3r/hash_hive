# Requirements Document

## Introduction

This document defines the requirements for reimplementing CipherSwarm as HashHive using a modern TypeScript stack. The migration preserves all core capabilities while modernizing with **Bun**, **Hono**, **PostgreSQL with Drizzle**, and **React 19 + Vite**. The system orchestrates distributed password cracking using hashcat across multiple agents in a private lab environment (7 cracking rigs), managing campaigns, attacks, tasks, and resources with comprehensive monitoring and project-based multi-tenancy.

**Key Architectural Principles:**
- Optimize for correctness, clarity, and developer experience (not premature scale)
- Batch operations for agent hash submissions
- Schema flows from Drizzle table definitions

## Glossary

- **HashHive**: The MERN-based reimplementation of CipherSwarm
- **CipherSwarm**: The legacy Rails 8 application being replaced
- **Agent**: A distributed worker node running hashcat for password cracking
- **Campaign**: A coordinated set of attacks targeting a specific hash list
- **Attack**: A single hashcat execution configuration with specific parameters
- **Task**: A unit of work assigned to an agent representing a keyspace partition
- **Hash List**: A collection of password hashes to be cracked
- **Resource**: Reusable artifacts including wordlists, rulelists, and masklists
- **Project**: A multi-tenant boundary for organizing users, agents, and campaigns
- **DAG**: Directed Acyclic Graph representing attack dependencies
- **Agent API**: Token-based HTTP API for agent communication
- **Web API**: Session-based HTTP API for operator UI
- **Control API**: RESTful API for automation and scripting
- **Keyspace**: The total search space for a hashcat attack
- **ODM**: Object-Document Mapper for MongoDB (Mongoose)
- **SSE**: Server-Sent Events for real-time updates
- **MCP**: Model Context Protocol for AI tool integration

## Requirements

### Requirement 1: Technology Stack Migration

**User Story:** As a platform maintainer, I want to migrate from Rails/PostgreSQL to a modern TypeScript stack with Bun and Drizzle, so that we have type-safe database access with Drizzle schemas as the single source of truth.

#### Acceptance Criteria

1. THE HashHive Backend SHALL use Bun (latest stable) as runtime, package manager, and test runner
2. THE HashHive Backend SHALL use Hono framework running natively on Bun.serve()
3. THE HashHive Backend SHALL use PostgreSQL with Drizzle ORM for all data persistence
4. THE HashHive Frontend SHALL use React 19 with Vite, TypeScript, Tailwind CSS, and shadcn/ui component library
5. THE HashHive System SHALL use Turborepo with Bun workspaces for monorepo management
6. THE HashHive System SHALL define all database schema as Drizzle table definitions in the `shared/` package
7. THE HashHive System SHALL use drizzle-zod to generate Zod schemas from Drizzle tables with TypeScript types inferred via `z.infer<typeof schema>`
8. THE HashHive System SHALL use bun:test for all tests
9. THE HashHive System SHALL use Biome for linting, formatting, and import sorting

### Requirement 2: Authentication and Authorization

**User Story:** As a system administrator, I want role-based access control with project-scoped permissions, so that users can securely access only their authorized projects and resources.

#### Acceptance Criteria

1. THE HashHive System SHALL implement JWT-based stateless authentication for Agent API endpoints
2. THE HashHive System SHALL implement HttpOnly session cookies for Dashboard API authentication
3. THE HashHive System SHALL support roles including admin, operator, analyst, and agent_owner with distinct permissions
4. THE HashHive System SHALL enforce project-scoped data access for all user operations
5. WHEN a user authenticates, THE HashHive System SHALL return user profile with project memberships and assigned roles

### Requirement 3: Agent Management and Registration

**User Story:** As an infrastructure administrator, I want agents to register with capability detection, so that tasks can be intelligently assigned based on hardware profiles.

#### Acceptance Criteria

1. WHEN an agent initiates registration, THE HashHive System SHALL authenticate using token-based credentials
2. THE HashHive System SHALL capture agent capabilities including operating system, hashcat version, GPU models, and CPU specifications
3. THE HashHive System SHALL store agent hardware profiles with device status and performance metrics
4. THE HashHive System SHALL track agent heartbeat with last_seen_at timestamps and status transitions
5. THE HashHive System SHALL record agent errors with severity levels, context, and associated task references

### Requirement 4: Agent API Contract

**User Story:** As an agent developer, I want a versioned OpenAPI specification for the Agent API, so that I can implement compatible Go-based agents with clear contracts and batch operations.

#### Acceptance Criteria

1. THE HashHive System SHALL define the Agent API in an OpenAPI YAML specification at openapi/agent-api.yaml
2. THE Agent API SHALL include endpoints for sessions, heartbeat, tasks/next, and tasks/:id/report
3. THE Agent API SHALL support batch operations for hash result submissions using Drizzle bulk inserts or raw Bun.SQL
4. THE Agent API SHALL handle periodic bursts when agents submit results, request work, and send heartbeats
5. WHEN an agent requests tasks/next, THE HashHive System SHALL return task descriptors matching agent capabilities

### Requirement 5: Campaign and Attack Orchestration

**User Story:** As a red team operator, I want to create campaigns with multiple attacks and DAG-based dependencies, so that I can orchestrate complex cracking workflows efficiently.

#### Acceptance Criteria

1. THE HashHive System SHALL support campaign creation with name, description, hash list reference, and priority
2. THE HashHive System SHALL support attack definitions with mode, hash type, wordlist, rulelist, masklist, and advanced configuration
3. THE HashHive System SHALL enforce DAG-based attack dependencies preventing circular references
4. THE HashHive System SHALL validate attack configurations against hashcat mode requirements
5. WHEN a campaign is started, THE HashHive System SHALL execute attacks in dependency order

### Requirement 6: Task Distribution and Scheduling

**User Story:** As a system operator, I want intelligent task distribution, so that agents receive work matching their capabilities with optimal utilization.

#### Acceptance Criteria

1. THE HashHive System SHALL generate tasks based on attack keyspace calculations and partition strategies
2. THE HashHive System SHALL store pending tasks in PostgreSQL with appropriate indexes
3. WHEN an agent calls tasks/next, THE HashHive System SHALL return the next appropriate task matching agent capabilities
4. THE HashHive System SHALL mark tasks as assigned with agent_id and assigned_at timestamp
5. THE HashHive System SHALL support task retry for failed tasks requiring intervention

### Requirement 7: Resource Management

**User Story:** As a campaign creator, I want to upload and manage hash lists, wordlists, rulelists, and masklists, so that I can reuse resources across multiple campaigns.

#### Acceptance Criteria

1. THE HashHive System SHALL store resource metadata in PostgreSQL with file path references
2. THE HashHive System SHALL support hash list uploads with automatic hash type detection
3. THE HashHive System SHALL parse uploaded hash lists into individual hash_items with hash_value and metadata
4. THE HashHive System SHALL support wordlist, rulelist, and masklist uploads with size and hashcat flag metadata
5. THE HashHive System SHALL enforce project-scoped access control for all resource operations

### Requirement 8: Real-Time Monitoring and Events

**User Story:** As an operator, I want real-time dashboard updates for agent status and campaign progress, so that I can monitor operations without manual refreshing.

#### Acceptance Criteria

1. THE HashHive System SHALL implement event streaming via WebSockets using hono/websocket at /events/stream endpoint
2. THE HashHive System SHALL emit events for agent_status, campaign_status, attack_status, task_update, and crack_result
3. THE HashHive Frontend SHALL subscribe to WebSocket streams and update UI components without page reloads
4. THE HashHive System SHALL throttle event emissions to prevent performance degradation
5. WHEN WebSocket connection is unavailable, THE HashHive Frontend SHALL fall back to polling

### Requirement 9: Hash Type Analysis

**User Story:** As a campaign creator, I want automatic hash type detection, so that I can quickly identify hash types without manual analysis.

#### Acceptance Criteria

1. THE HashHive System SHALL provide a /hashes/guess-type endpoint accepting hash-like content
2. WHEN hash content is submitted, THE HashHive System SHALL return candidate hash types with confidence scores
3. THE HashHive System SHALL map detected hash types to hashcat mode numbers
4. THE HashHive System SHALL validate hash format against hashcat mode requirements
5. THE HashHive System SHALL support multiple hash type candidates ranked by confidence

### Requirement 10: Dashboard API for Web UI

**User Story:** As a frontend developer, I want a standard REST API for the React dashboard, so that I can use TanStack Query for data fetching without tRPC complexity.

#### Acceptance Criteria

1. THE HashHive System SHALL expose Dashboard API endpoints at /api/v1/dashboard/* with resource-oriented URIs
2. THE Dashboard API SHALL support campaign creation, attack management, resource import, and status queries
3. THE Dashboard API SHALL use standard REST patterns (GET, POST, PATCH, DELETE) with Zod validation
4. THE Dashboard API SHALL share authentication and authorization with Agent API using session cookies
5. THE Dashboard API SHALL provide stable identifiers and pagination conventions for low-traffic usage (1-3 concurrent users)

### Requirement 11: Data Migration from Rails

**User Story:** As a platform maintainer, I want repeatable data migration scripts, so that I can migrate production data from Rails PostgreSQL to HashHive PostgreSQL with validation.

#### Acceptance Criteria

1. THE HashHive System SHALL provide migration scripts exporting Rails PostgreSQL data to neutral interchange formats
2. THE Migration Scripts SHALL transform Rails schema into Drizzle table definitions with appropriate normalization
3. THE Migration Scripts SHALL be idempotent and safely re-runnable in staging environments
4. THE Migration Scripts SHALL validate migrated data with row counts and spot checks of critical entities
5. THE Migration Scripts SHALL preserve functional equivalence for all user workflows and data relationships

### Requirement 12: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage with integration tests, so that I can ensure system reliability and catch regressions early.

#### Acceptance Criteria

1. THE HashHive Backend SHALL use bun:test for all unit and integration tests
2. THE HashHive Backend SHALL use test database for integration tests with PostgreSQL
3. THE HashHive Frontend SHALL use bun:test with Testing Library for component tests
4. THE HashHive Frontend SHALL use Playwright for end-to-end workflow tests
5. THE HashHive System SHALL maintain 90% or greater test coverage for new code

### Requirement 13: Deployment and Operations

**User Story:** As a DevOps engineer, I want containerized deployment with health checks, so that I can deploy HashHive reliably with zero-downtime updates.

#### Acceptance Criteria

1. THE HashHive System SHALL provide Docker images for API server, web UI, and PostgreSQL
2. THE HashHive System SHALL provide docker-compose.yml for local development stack
3. THE HashHive System SHALL expose health check endpoints for monitoring and orchestration
4. THE HashHive System SHALL support structured logging with appropriate log levels
5. THE HashHive System SHALL support zero-downtime deployments with rollback capabilities

### Requirement 14: Web UI Dashboard

**User Story:** As an operator, I want a comprehensive dashboard showing agent health, campaign progress, and recent results, so that I can monitor system status at a glance.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display agent status tiles with online/offline counts and health indicators
2. THE HashHive Frontend SHALL display campaign progress with completion percentages and ETA estimates
3. THE HashHive Frontend SHALL display recent crack results with hash values and plaintext passwords
4. THE HashHive Frontend SHALL display 8-hour rolling hash rate trends with performance charts
5. THE HashHive Frontend SHALL update dashboard components in real-time via WebSocket subscriptions
6. THE HashHive Frontend SHALL use Zustand for client-side UI state (selected agents, filter preferences, dashboard layout)

### Requirement 15: Campaign Creation Wizard

**User Story:** As a red team operator, I want a guided campaign creation wizard, so that I can configure campaigns step-by-step with validation and preview.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL provide a multi-step wizard for campaign creation with progress indicators
2. THE HashHive Frontend SHALL support direct file uploads for hash lists with file storage integration
3. THE HashHive Frontend SHALL provide attack configuration forms with mode-specific field validation using shared Zod schemas from drizzle-zod
4. THE HashHive Frontend SHALL provide visual DAG editor for attack dependencies with drag-and-drop
5. WHEN campaign configuration is complete, THE HashHive Frontend SHALL display summary preview before submission
