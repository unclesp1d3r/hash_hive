# Requirements Document

## Introduction

This document defines the requirements for reimplementing CipherSwarm as HashHive using a modern TypeScript stack. The migration preserves all core capabilities while modernizing with **Bun**, **Hono**, **PostgreSQL with Drizzle**, and **React 19 + Vite**. The system orchestrates distributed password cracking using hashcat across multiple agents in a private lab environment (7 cracking rigs), managing campaigns, attacks, tasks, and resources with comprehensive monitoring and project-based multi-tenancy.

HashHive enables three primary user roles — Admin, Contributor, and Viewer — to create and monitor cracking campaigns, manage agent fleets, and analyze results through a unified web dashboard with real-time updates.

**Key Architectural Principles:**
- Optimize for correctness, clarity, and developer experience (not premature scale)
- Batch operations for agent hash submissions
- Schema flows from Drizzle table definitions
- Private lab environment: 7 cracking rigs, 1-3 concurrent dashboard users

## Glossary

- **HashHive**: The TypeScript-based reimplementation of CipherSwarm using Bun, Hono, PostgreSQL, and React
- **CipherSwarm**: The legacy Rails application being replaced
- **Agent**: A distributed worker node running hashcat for password cracking
- **Campaign**: A coordinated set of attacks targeting a specific hash list
- **Attack**: A single hashcat execution configuration with specific parameters
- **Task**: A unit of work assigned to an agent representing a keyspace partition
- **Hash_List**: A collection of password hashes to be cracked
- **Hash_Item**: An individual hash entry within a Hash_List, with crack status tracking
- **Resource**: Reusable artifacts including wordlists, rulelists, and masklists
- **Project**: A multi-tenant boundary for organizing users, agents, and campaigns
- **DAG**: Directed Acyclic Graph representing attack dependencies within a campaign
- **Agent_API**: Token-based HTTP API for agent communication (`/api/v1/agent/*`)
- **Dashboard_API**: Session-based HTTP API for the React frontend (`/api/v1/dashboard/*`)
- **Keyspace**: The total search space for a hashcat attack
- **Admin**: A role with global system administration privileges including user and project management; can also create campaigns, manage resources, and review results
- **Contributor**: A role that can create and run campaigns and manage resources; cannot manage users or projects
- **Viewer**: A read-only role that can view campaigns, resources, and results; cannot create or modify campaigns or resources
- **Stat_Card**: A clickable summary tile on the Dashboard showing a key metric
- **Campaign_Wizard**: A 3-step guided form for campaign creation (Basic Info → Attacks → Review)
- **DAG_Editor**: A visual graph editor for defining attack dependencies with drag-and-drop connections
- **Connection_Indicator**: A UI element showing WebSocket connection status (green = connected, gray = disconnected)

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

### Requirement 2: Authentication and Session Management

**User Story:** As a user, I want to log in with my credentials and select a project, so that I can securely access my authorized projects and begin working.

#### Acceptance Criteria

1. THE HashHive System SHALL implement pre-shared token authentication for Agent_API endpoints
2. THE HashHive System SHALL implement JWT with HttpOnly session cookies for Dashboard_API authentication
3. WHEN a user submits valid credentials on the login page, THE HashHive System SHALL create a session and determine the user's project memberships
4. WHEN an authenticated user has exactly one project, THE HashHive System SHALL auto-select that project and redirect to the Dashboard
5. WHEN an authenticated user has multiple projects, THE HashHive System SHALL display a project selector showing each project with the user's role (Admin, Contributor, or Viewer)
6. WHEN a user selects a project, THE HashHive System SHALL set the project context and redirect to the Dashboard
7. THE HashHive Frontend SHALL display the selected project name in the sidebar with an option to switch projects
8. THE HashHive Frontend SHALL persist the selected project context across page navigation
9. IF authentication fails, THEN THE HashHive Frontend SHALL display an error message below the login form
10. THE HashHive Frontend SHALL show a loading state on the login button during authentication

### Requirement 3: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access control with project-scoped permissions, so that Admins, Contributors, and Viewers each have appropriate access levels.

#### Acceptance Criteria

1. THE HashHive System SHALL support three roles: Admin (global system administration plus full campaign/resource/result access), Contributor (campaign creation and execution, resource management), and Viewer (read-only access to campaigns, resources, and results)
2. THE HashHive System SHALL enforce project-scoped data access for all user operations
3. THE HashHive System SHALL restrict user and project management operations to the Admin role
4. THE HashHive System SHALL allow Admin and Contributor roles to create campaigns and manage resources within their assigned projects
5. THE HashHive System SHALL allow all roles (including Viewer) to view campaigns, resources, and cracking results within their assigned projects
6. THE HashHive System SHALL restrict campaign lifecycle actions (start, pause, stop) to Admin and Contributor roles
6. WHEN a user authenticates, THE HashHive System SHALL return user profile with project memberships and assigned roles

### Requirement 4: Navigation and Layout

**User Story:** As a user, I want consistent navigation and real-time connection status, so that I can efficiently move between sections and know when live updates are active.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display a sidebar with navigation links: Dashboard, Campaigns, Agents, Resources, Results
2. THE HashHive Frontend SHALL display a project selector dropdown in the sidebar header
3. THE HashHive Frontend SHALL display a user menu in the top-right area with Profile, Settings, and Logout options
4. THE HashHive Frontend SHALL display a Connection_Indicator in the top-right area showing WebSocket status (green dot for connected, gray dot for disconnected)
5. THE HashHive Frontend SHALL display breadcrumbs on detail pages (e.g., Campaign List > Campaign Name) with clickable navigation
6. THE HashHive Frontend SHALL use Zustand for client-side UI state (selected project, filter preferences, dashboard layout)

### Requirement 5: Dashboard Monitoring

**User Story:** As a user, I want a dashboard with real-time stat cards showing agent health, campaign activity, running tasks, and cracked hashes, so that I can monitor system status at a glance.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display four Stat_Cards on the Dashboard: Agents (online/total), Active Campaigns (count), Running Tasks (count), and Total Cracked Hashes (count)
2. THE HashHive Frontend SHALL update Stat_Card values in real-time via WebSocket subscriptions without page refresh
3. WHEN a user clicks a Stat_Card, THE HashHive Frontend SHALL navigate to the relevant detail page (e.g., Agents card navigates to Agent list)
4. THE HashHive Frontend SHALL display a loading skeleton while Dashboard stats are loading
5. WHEN no project is selected, THE HashHive Frontend SHALL display an empty state message on the Dashboard
6. WHEN the WebSocket connection is lost, THE HashHive Frontend SHALL update the Connection_Indicator to disconnected and fall back to periodic polling

### Requirement 6: Real-Time Event Streaming

**User Story:** As a user, I want real-time updates pushed to the dashboard, so that I can monitor operations without manual refreshing.

#### Acceptance Criteria

1. THE HashHive System SHALL implement event streaming via WebSockets using hono/websocket at /events/stream endpoint
2. THE HashHive System SHALL emit events for agent_status, campaign_status, attack_status, task_update, and crack_result
3. THE HashHive Frontend SHALL subscribe to WebSocket streams and update UI components without page reloads
4. THE HashHive System SHALL throttle event emissions to prevent performance degradation
5. WHEN WebSocket connection is unavailable, THE HashHive Frontend SHALL fall back to polling with slower update frequency
6. THE HashHive Frontend SHALL apply real-time updates silently without toast notifications for routine events (toasts reserved for user-initiated actions only)

### Requirement 7: Agent Management and Registration

**User Story:** As an infrastructure administrator, I want agents to register with capability detection and be monitored in a list view, so that I can track fleet health and troubleshoot issues.

#### Acceptance Criteria

1. WHEN an agent initiates registration, THE HashHive System SHALL authenticate using token-based credentials
2. THE HashHive System SHALL capture agent capabilities including operating system, hashcat version, GPU models, and CPU specifications
3. THE HashHive System SHALL store agent hardware profiles with device status and performance metrics
4. THE HashHive System SHALL track agent heartbeat with last_seen_at timestamps and status transitions
5. THE HashHive System SHALL record agent errors with severity levels (warning, error, fatal), context, and associated task references

### Requirement 8: Agent Monitoring UI

**User Story:** As an administrator, I want to view agent status in a list with error indicators and drill into agent details, so that I can monitor fleet health and diagnose problems.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display an agent list table with columns: Name, Status, Last Seen, Errors, and a Details action
2. THE HashHive Frontend SHALL support filtering agents by status (online, offline, busy, error)
3. THE HashHive Frontend SHALL display agent status as a colored badge with icon
4. THE HashHive Frontend SHALL display Last Seen as relative time (e.g., "2 minutes ago")
5. THE HashHive Frontend SHALL display an error badge (red dot with count) on agents that have logged errors
6. THE HashHive Frontend SHALL update agent status in real-time via WebSocket
7. WHEN a user clicks Details on an agent, THE HashHive Frontend SHALL display the agent detail view with hardware profile (OS, GPU models, CPU specs, hashcat version), current task assignment with campaign link, and an error log table
8. THE HashHive Frontend SHALL display the agent error log with columns: Timestamp, Severity, Message, and Task link
9. THE HashHive Frontend SHALL support filtering agent errors by severity (warning, error, fatal)
10. THE HashHive Frontend SHALL display error severity as a colored badge
11. THE HashHive Frontend SHALL display an empty state message when no agents are registered

### Requirement 9: Agent API Contract

**User Story:** As an agent developer, I want a versioned OpenAPI specification for the Agent_API, so that I can implement compatible Go-based agents with clear contracts and batch operations.

#### Acceptance Criteria

1. THE HashHive System SHALL define the Agent_API in an OpenAPI YAML specification at openapi/agent-api.yaml
2. THE Agent_API SHALL include endpoints for sessions, heartbeat, tasks/next, and tasks/:id/report
3. THE Agent_API SHALL support batch operations for hash result submissions using Drizzle bulk inserts or raw Bun.SQL
4. THE Agent_API SHALL handle periodic bursts when agents submit results, request work, and send heartbeats
5. WHEN an agent requests tasks/next, THE HashHive System SHALL return task descriptors matching agent capabilities

### Requirement 10: Campaign Creation Wizard

**User Story:** As a contributor, I want a 3-step campaign creation wizard (Basic Info → Attacks → Review), so that I can configure campaigns with validation and preview before submission.

#### Acceptance Criteria

1. THE Campaign_Wizard SHALL display a 3-step progress indicator showing: Basic Info, Attacks, and Review
2. THE Campaign_Wizard SHALL allow clicking previous steps in the progress indicator to navigate back

**Step 1 — Basic Info:**
3. THE Campaign_Wizard SHALL require a campaign name field
4. THE Campaign_Wizard SHALL provide an optional description field
5. THE Campaign_Wizard SHALL provide a priority input (1-10 range via slider or number input)
6. THE Campaign_Wizard SHALL provide a hash list dropdown to select an existing Hash_List OR an "Upload New" button for inline upload
7. WHEN a user clicks "Upload New", THE Campaign_Wizard SHALL open a file picker, show upload progress, and add the uploaded Hash_List to the dropdown
8. WHEN the user clicks "Next: Configure Attacks", THE Campaign_Wizard SHALL validate the form and advance to Step 2

**Step 2 — Attacks:**
9. THE Campaign_Wizard SHALL display an attack configuration form with hashcat mode dropdown, and optional wordlist, rulelist, or masklist selectors (with inline upload support)
10. THE Campaign_Wizard SHALL display a visual DAG_Editor below the attack form
11. WHEN a user clicks "Add Attack", THE Campaign_Wizard SHALL add the attack as a node in the DAG_Editor
12. THE Campaign_Wizard SHALL allow users to drag connections between attack nodes to define dependencies
13. THE Campaign_Wizard SHALL validate the DAG for circular dependencies and highlight invalid connections in red
14. THE Campaign_Wizard SHALL allow removing attacks by clicking a delete icon on the node
15. WHEN the user clicks "Next: Review", THE Campaign_Wizard SHALL validate that at least one attack exists and advance to Step 3

**Step 3 — Review & Submit:**
16. THE Campaign_Wizard SHALL display a campaign summary card with all configured details, attack count, and DAG preview
17. THE Campaign_Wizard SHALL provide a "Back" button to return to editing and a "Create Campaign" button to submit
18. WHEN the user clicks "Create Campaign", THE Campaign_Wizard SHALL submit the campaign and all attacks, then redirect to the campaign detail page with a success message
19. IF campaign creation fails, THEN THE Campaign_Wizard SHALL display an error message
20. THE Campaign_Wizard SHALL show a loading state on the "Create Campaign" button during submission
21. THE Campaign_Wizard SHALL display inline validation errors below form fields

### Requirement 11: Campaign and Attack Orchestration

**User Story:** As a contributor, I want campaigns with multiple attacks and DAG-based dependencies, so that I can orchestrate complex cracking workflows efficiently.

#### Acceptance Criteria

1. THE HashHive System SHALL support campaign creation with name, description, hash list reference, and priority (1-10)
2. THE HashHive System SHALL support attack definitions with mode, hash type, wordlist, rulelist, masklist, and advanced configuration
3. THE HashHive System SHALL enforce DAG-based attack dependencies preventing circular references
4. THE HashHive System SHALL validate attack configurations against hashcat mode requirements
5. WHEN a campaign is started, THE HashHive System SHALL execute attacks in dependency order
6. THE HashHive System SHALL support campaign lifecycle states: draft, running, paused, completed, cancelled
7. WHEN a campaign is stopped, THE HashHive System SHALL cancel current tasks and return the campaign to draft status (allowing restart)
8. THE HashHive System SHALL require at least one attack before a campaign can be started

### Requirement 12: Campaign Management UI

**User Story:** As a contributor, I want to view, filter, and control campaigns from a list view and drill into campaign details with DAG visualization, so that I can manage campaign execution effectively.

#### Acceptance Criteria

**Campaign List:**
1. THE HashHive Frontend SHALL display a campaign list table with columns: Name, Status, Progress, Priority, and Actions
2. THE HashHive Frontend SHALL support filtering campaigns by status (draft, running, paused, completed, failed)
3. THE HashHive Frontend SHALL support sorting campaigns by any column
4. THE HashHive Frontend SHALL display campaign status as a colored badge (draft=gray, running=blue, paused=yellow, completed=green, failed=red)
5. THE HashHive Frontend SHALL display campaign progress as a percentage with a progress bar
6. THE HashHive Frontend SHALL display quick action buttons per row: Start (for draft/paused), Pause (for running), Stop (for running)
7. THE HashHive Frontend SHALL disable quick action buttons when the action is not valid for the current campaign status
8. WHEN a user clicks Start from the campaign list, THE HashHive Frontend SHALL open a confirmation modal before starting the campaign
9. WHEN a user clicks Pause or Stop from the campaign list, THE HashHive Frontend SHALL apply the action immediately
10. THE HashHive Frontend SHALL update campaign status and progress in real-time via WebSocket
11. WHEN a user clicks a campaign name, THE HashHive Frontend SHALL navigate to the campaign detail view

**Campaign Detail:**
12. THE HashHive Frontend SHALL display a campaign detail header with name, status badge, and action buttons (Start, Pause, Stop, View Results)
13. THE HashHive Frontend SHALL display a Progress Panel showing completion percentage, ETA, hash rate, and cracked count
14. THE HashHive Frontend SHALL display a DAG Visualization showing attack nodes with status-colored indicators (pending=gray, running=blue, completed=green, failed=red)
15. WHEN a user clicks an attack node in the DAG Visualization, THE HashHive Frontend SHALL display attack details
16. THE HashHive Frontend SHALL display an Agent & Task Distribution table showing which agents are working on which tasks with progress
17. THE HashHive Frontend SHALL update the Progress Panel and Agent & Task Distribution table in real-time
18. WHEN a user clicks Start from the campaign detail, THE HashHive Frontend SHALL start the campaign (one-click, no confirmation modal)
19. THE HashHive Frontend SHALL show a loading state on action buttons during status changes and display a confirmation toast after completion

### Requirement 13: Task Distribution and Scheduling

**User Story:** As a system operator, I want intelligent task distribution, so that agents receive work matching their capabilities with optimal utilization.

#### Acceptance Criteria

1. THE HashHive System SHALL generate tasks based on attack keyspace calculations and partition strategies
2. THE HashHive System SHALL store pending tasks in PostgreSQL with appropriate indexes
3. WHEN an agent calls tasks/next, THE HashHive System SHALL return the next appropriate task matching agent capabilities
4. THE HashHive System SHALL mark tasks as assigned with agent_id and assigned_at timestamp
5. THE HashHive System SHALL support task retry for failed tasks requiring intervention

### Requirement 14: Resource Management

**User Story:** As a campaign creator, I want to upload and manage hash lists, wordlists, rulelists, and masklists through a tabbed interface, so that I can reuse resources across multiple campaigns.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display a Resources page with a tabbed interface: Hash Lists, Wordlists, Rulelists, Masklists, and Hash Detect
2. WHEN a user clicks a tab, THE HashHive Frontend SHALL display a table of resources for that type with columns: Name, Created, and type-specific columns (Hash Lists additionally show Hash Count and Cracked Count)
3. THE HashHive Frontend SHALL display an Upload button at the top of each resource tab
4. WHEN a user clicks Upload, THE HashHive Frontend SHALL open a file picker followed by an upload modal with a name field (pre-filled from filename) and optional metadata
5. THE HashHive Frontend SHALL display upload progress as a percentage during file upload
6. WHEN upload completes successfully, THE HashHive Frontend SHALL add the resource to the table and show a success toast
7. IF upload fails, THEN THE HashHive Frontend SHALL display an error message (file too large, invalid format, etc.)
8. THE HashHive Frontend SHALL display an empty state with "Upload your first [resource type]" message when no resources exist for a tab
9. THE HashHive System SHALL store resource metadata in PostgreSQL with file path references to MinIO storage
10. THE HashHive System SHALL support hash list uploads with automatic hash type detection
11. THE HashHive System SHALL parse uploaded hash lists into individual Hash_Items with hash_value and metadata
12. THE HashHive System SHALL support wordlist, rulelist, and masklist uploads with size and hashcat flag metadata
13. THE HashHive System SHALL enforce project-scoped access control for all resource operations
14. THE HashHive System SHALL support resource files in excess of 100 GB by using streaming uploads (never buffering entire files in memory) with S3 multipart upload to MinIO
15. THE HashHive Frontend SHALL use chunked uploads for large resource files, providing progress feedback and supporting upload resumption on network interruption
16. THE HashHive System SHALL stream large resource files directly from MinIO to agents via presigned URLs, avoiding backend memory buffering

### Requirement 15: Hash Type Detection

**User Story:** As a campaign creator, I want to detect hash types from the Resources page, so that I can quickly identify unknown hashes before configuring attacks.

#### Acceptance Criteria

1. THE HashHive Frontend SHALL display a Hash Detect tab within the Resources page with an input field (placeholder: "Enter a hash value...")
2. WHEN a user submits a hash value (via Enter key or "Detect Type" button), THE HashHive System SHALL analyze the hash and return candidate types with confidence scores
3. THE HashHive Frontend SHALL display results in a table with columns: Type, Hashcat Mode, Category, and Confidence (shown as a colored progress bar: green for high, yellow for medium, red for low)
4. THE HashHive Frontend SHALL sort results by confidence (highest first)
5. THE HashHive Frontend SHALL allow users to copy the hashcat mode number from the results
6. THE HashHive System SHALL map detected hash types to hashcat mode numbers
7. THE HashHive System SHALL validate hash format against hashcat mode requirements
8. IF no matching hash types are found, THEN THE HashHive Frontend SHALL display "No matching hash types found"
9. THE HashHive Frontend SHALL show a loading state on the Detect button during analysis

### Requirement 16: Result Analysis

**User Story:** As a viewer, I want to review cracked passwords across dedicated views, campaign-scoped tabs, and hash list details, so that I can analyze results and track cracking effectiveness.

#### Acceptance Criteria

**Results Page (Dedicated View):**
1. THE HashHive Frontend SHALL provide a dedicated Results page accessible from the sidebar navigation
2. THE HashHive Frontend SHALL display a table of all cracked hashes across all campaigns with columns: Hash Value, Plaintext (monospace font), Campaign, Attack Method, and Cracked At
3. THE HashHive Frontend SHALL support filtering results by campaign, attack method, or date range
4. THE HashHive Frontend SHALL support searching results by hash value or plaintext
5. THE HashHive Frontend SHALL provide an "Export CSV" button that downloads results as a CSV file
6. THE HashHive Frontend SHALL support pagination for large result sets
7. WHEN a user clicks a campaign name in the results table, THE HashHive Frontend SHALL navigate to the campaign detail page
8. THE HashHive Frontend SHALL update the results table in real-time as new hashes are cracked

**Campaign Results Tab:**
9. THE HashHive Frontend SHALL display a "Results" tab on the campaign detail page
10. WHEN a user clicks the Results tab, THE HashHive Frontend SHALL display cracked hashes filtered to that campaign only, with the same columns as the dedicated Results page
11. THE HashHive Frontend SHALL support filtering campaign results by attack method within the campaign

**Hash List Detail:**
12. WHEN a user clicks a hash list name from the Resources page, THE HashHive Frontend SHALL display a hash list detail view
13. THE HashHive Frontend SHALL display hash list statistics: Total Hashes, Cracked Count, and Crack Rate percentage with a visual progress bar
14. THE HashHive Frontend SHALL display a table of all hashes in the list with columns: Hash Value, Plaintext, Status (Cracked=green badge, Pending=gray badge), and Cracked At
15. THE HashHive Frontend SHALL display a link to the campaign that cracked each hash

### Requirement 17: Dashboard API for Web UI

**User Story:** As a frontend developer, I want a standard REST API for the React dashboard, so that I can use TanStack Query for data fetching without tRPC complexity.

#### Acceptance Criteria

1. THE HashHive System SHALL expose Dashboard_API endpoints at /api/v1/dashboard/* with resource-oriented URIs
2. THE Dashboard_API SHALL support campaign CRUD, attack management, resource upload, status queries, and result retrieval
3. THE Dashboard_API SHALL use standard REST patterns (GET, POST, PATCH, DELETE) with Zod validation
4. THE Dashboard_API SHALL use JWT with HttpOnly session cookies for authentication
5. THE Dashboard_API SHALL provide stable identifiers and pagination conventions for low-traffic usage (1-3 concurrent users)

### Requirement 18: Data Migration from Rails

**User Story:** As a platform maintainer, I want repeatable data migration scripts, so that I can migrate production data from Rails PostgreSQL to HashHive PostgreSQL with validation.

#### Acceptance Criteria

1. THE HashHive System SHALL provide migration scripts exporting Rails PostgreSQL data to neutral interchange formats
2. THE Migration Scripts SHALL transform Rails schema into Drizzle table definitions with appropriate normalization
3. THE Migration Scripts SHALL be idempotent and safely re-runnable in staging environments
4. THE Migration Scripts SHALL validate migrated data with row counts and spot checks of critical entities
5. THE Migration Scripts SHALL preserve functional equivalence for all user workflows and data relationships

### Requirement 19: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage with integration tests, so that I can ensure system reliability and catch regressions early.

#### Acceptance Criteria

1. THE HashHive Backend SHALL use bun:test for all unit and integration tests
2. THE HashHive Backend SHALL use a test database for integration tests with PostgreSQL
3. THE HashHive Frontend SHALL use bun:test with Testing Library for component tests
4. THE HashHive Frontend SHALL use Playwright for end-to-end workflow tests
5. THE HashHive System SHALL maintain 90% or greater test coverage for new code

### Requirement 20: Deployment and Operations

**User Story:** As a DevOps engineer, I want containerized deployment with health checks, so that I can deploy HashHive reliably with zero-downtime updates.

#### Acceptance Criteria

1. THE HashHive System SHALL provide Docker images for API server, web UI, and PostgreSQL
2. THE HashHive System SHALL provide docker-compose.yml for local development stack
3. THE HashHive System SHALL expose health check endpoints for monitoring and orchestration
4. THE HashHive System SHALL support structured logging with appropriate log levels
5. THE HashHive System SHALL support zero-downtime deployments with rollback capabilities
