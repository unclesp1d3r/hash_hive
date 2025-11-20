# Requirements Document

## Introduction

This document defines the requirements for migrating CipherSwarm from a Rails 8 monolith to a modern MERN stack (MongoDB, Express, React, Node.js) implementation called HashHive. The migration preserves all core capabilities while modernizing the technology stack, improving user experience with real-time features, and establishing a single-language TypeScript codebase across frontend and backend. The system orchestrates distributed password cracking using hashcat across multiple agents in a LAN environment, managing campaigns, attacks, tasks, and resources with comprehensive monitoring and project-based multi-tenancy.

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

**User Story:** As a platform maintainer, I want to migrate from Rails/PostgreSQL to MERN stack, so that we have a unified TypeScript codebase with shared types across frontend and backend.

#### Acceptance Criteria

1. THE HashHive Backend SHALL use Node.js LTS with TypeScript, Express or Fastify framework, and MongoDB with Mongoose ODM
2. THE HashHive Frontend SHALL use Next.js with React, TypeScript, Tailwind CSS, and shadcn/ui component library
3. THE HashHive System SHALL use BullMQ with Redis for background job processing and task queue management
4. THE HashHive System SHALL use S3-compatible object storage via Node SDK for binary artifacts
5. THE HashHive System SHALL share TypeScript types between backend models, API DTOs, and frontend components

### Requirement 2: Authentication and Authorization

**User Story:** As a system administrator, I want role-based access control with project-scoped permissions, so that users can securely access only their authorized projects and resources.

#### Acceptance Criteria

1. THE HashHive System SHALL implement JWT-based stateless authentication for API endpoints
2. THE HashHive System SHALL implement HttpOnly session cookies for web UI authentication
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

**User Story:** As an agent developer, I want a versioned OpenAPI specification for the Agent API, so that I can implement compatible agents in any language with clear contracts.

#### Acceptance Criteria

1. THE HashHive System SHALL define the Agent API in an OpenAPI YAML specification at openapi/agent-api.yaml
2. THE Agent API SHALL include endpoints for sessions, heartbeat, tasks/next, and tasks/:id/report
3. THE Agent API SHALL use semantic versioning with x-agent-api-version header
4. THE Agent API SHALL support hashcat 6.x baseline with optional hashcat 7.x capability flags
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

**User Story:** As a system operator, I want intelligent task distribution using message queues, so that agents receive work matching their capabilities with optimal utilization.

#### Acceptance Criteria

1. THE HashHive System SHALL generate tasks based on attack keyspace calculations and partition strategies
2. THE HashHive System SHALL enqueue pending tasks into BullMQ queues keyed by campaign and capability tags
3. WHEN an agent calls tasks/next, THE HashHive System SHALL pop the next appropriate task from capability-matched queues
4. THE HashHive System SHALL mark tasks as assigned with agent_id and assigned_at timestamp
5. THE HashHive System SHALL support task retry with dead-letter queues for failed tasks requiring intervention

### Requirement 7: Resource Management

**User Story:** As a campaign creator, I want to upload and manage hash lists, wordlists, rulelists, and masklists, so that I can reuse resources across multiple campaigns.

#### Acceptance Criteria

1. THE HashHive System SHALL store resource metadata in MongoDB with file references to S3-compatible object storage
2. THE HashHive System SHALL support hash list uploads with automatic hash type detection
3. THE HashHive System SHALL parse uploaded hash lists into individual hash_items with hash_value and metadata
4. THE HashHive System SHALL support wordlist, rulelist, and masklist uploads with size and hashcat flag metadata
5. THE HashHive System SHALL enforce project-scoped access control for all resource operations

### Requirement 8: Real-Time Monitoring and Events

**User Story:** As an operator, I want real-time dashboard updates for agent status and campaign progress, so that I can monitor operations without manual refreshing.

#### Acceptance Criteria

1. THE HashHive System SHALL implement event streaming via WebSockets or SSE at /events/stream endpoint
2. THE HashHive System SHALL emit events for agent_status, campaign_status, attack_status, task_update, and crack_result
3. THE HashHive Frontend SHALL subscribe to event streams and update UI components without page reloads
4. THE HashHive System SHALL throttle event emissions to prevent performance degradation
5. WHEN real-time channel is unavailable, THE HashHive Frontend SHALL fall back to polling

### Requirement 9: Hash Type Analysis

**User Story:** As a campaign creator, I want automatic hash type detection, so that I can quickly identify hash types without manual analysis.

#### Acceptance Criteria

1. THE HashHive System SHALL provide a /hashes/guess-type endpoint accepting hash-like content
2. WHEN hash content is submitted, THE HashHive System SHALL return candidate hash types with confidence scores
3. THE HashHive System SHALL map detected hash types to hashcat mode numbers
4. THE HashHive System SHALL validate hash format against hashcat mode requirements
5. THE HashHive System SHALL support multiple hash type candidates ranked by confidence

### Requirement 10: Control API for Automation

**User Story:** As an automation engineer, I want RESTful Control API endpoints, so that I can integrate HashHive with n8n, MCP tools, and custom scripts.

#### Acceptance Criteria

1. THE HashHive System SHALL expose Control API endpoints at /api/v1/control/* with resource-oriented URIs
2. THE Control API SHALL support campaign creation, attack management, resource import, and status queries
3. THE Control API SHALL use idempotent PUT and DELETE operations where applicable
4. THE Control API SHALL share authentication and authorization with Web API using tokens and roles
5. THE Control API SHALL provide stable identifiers and pagination conventions for scripting

### Requirement 11: Data Migration from Rails

**User Story:** As a platform maintainer, I want repeatable data migration scripts, so that I can migrate production data from PostgreSQL to MongoDB with validation.

#### Acceptance Criteria

1. THE HashHive System SHALL provide migration scripts exporting PostgreSQL data to neutral interchange formats
2. THE Migration Scripts SHALL transform relational data into MongoDB documents with appropriate normalization
3. THE Migration Scripts SHALL be idempotent and safely re-runnable in staging environments
4. THE Migration Scripts SHALL validate migrated data with row counts and spot checks of critical entities
5. THE Migration Scripts SHALL preserve functional equivalence for all user workflows and data relationships

### Requirement 12: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage with integration tests, so that I can ensure system reliability and catch regressions early.

#### Acceptance Criteria

1. THE HashHive Backend SHALL use Jest with supertest for HTTP API tests
2. THE HashHive Backend SHALL use Testcontainers for integration tests with MongoDB, Redis, and MinIO
3. THE HashHive Frontend SHALL use Jest with React Testing Library for component tests
4. THE HashHive Frontend SHALL use Playwright for end-to-end workflow tests
5. THE HashHive System SHALL maintain 90% or greater test coverage for new code

### Requirement 13: Deployment and Operations

**User Story:** As a DevOps engineer, I want containerized deployment with health checks, so that I can deploy HashHive reliably with zero-downtime updates.

#### Acceptance Criteria

1. THE HashHive System SHALL provide Docker images for API server, web UI, MongoDB, Redis, and MinIO
2. THE HashHive System SHALL provide docker-compose.yml for local development stack
3. THE HashHive System SHALL expose health check endpoints for monitoring and orchestration
4. THE HashHive System SHALL support structured logging with Pino and OpenTelemetry-compatible exporters
5. THE HashHive System SHALL support zero-downtime deployments with rollback capabilities

### Requirement 14: Web UI Dashboard

**User Story:** As an operator, I want a comprehensive dashboard showing agent health, campaign progress, and recent results, so that I can monitor system status at a glance.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display agent status tiles with online/offline counts and health indicators
2. THE HashHive Frontend SHALL display campaign progress with completion percentages and ETA estimates
3. THE HashHive Frontend SHALL display recent crack results with hash values and plaintext passwords
4. THE HashHive Frontend SHALL display 8-hour rolling hash rate trends with performance charts
5. THE HashHive Frontend SHALL update dashboard components in real-time via event subscriptions

### Requirement 15: Campaign Creation Wizard

**User Story:** As a red team operator, I want a guided campaign creation wizard, so that I can configure campaigns step-by-step with validation and preview.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL provide a multi-step wizard for campaign creation with progress indicators
2. THE HashHive Frontend SHALL support direct file uploads for hash lists with ActiveStorage-style integration
3. THE HashHive Frontend SHALL provide attack configuration forms with mode-specific field validation
4. THE HashHive Frontend SHALL provide visual DAG editor for attack dependencies with drag-and-drop
5. WHEN campaign configuration is complete, THE HashHive Frontend SHALL display summary preview before submission
