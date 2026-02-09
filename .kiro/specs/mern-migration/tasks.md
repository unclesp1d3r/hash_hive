# Implementation Plan: HashHive Migration

## Overview

This implementation plan breaks down the migration from Rails-based CipherSwarm to TypeScript-based HashHive using **Bun**, **Hono**, **PostgreSQL with Drizzle ORM**, and **React 19 + Vite**. The plan follows an incremental approach where each task builds on previous work, with testing integrated throughout. The architecture uses Drizzle table definitions as the single source of truth, with Zod schemas generated via drizzle-zod and types inferred via `z.infer<typeof schema>`.

## Tasks

- [x] 1. Project foundation and monorepo setup
  - Initialize Turborepo with Bun workspaces (backend, frontend, shared, openapi packages)
  - Configure TypeScript for all packages with strict mode and shared tsconfig.base.json
  - Set up Biome for linting, formatting, and import sorting across all packages
  - Create turbo.json with pipeline configuration for dev, build, test, lint tasks
  - Configure environment variable management with validation
  - _Requirements: 1.1, 1.5, 1.9, 13.2_

- [x] 2. Infrastructure and development environment
  - [x] 2.1 Create Docker Compose configuration
    - Add PostgreSQL 16 service with initialization scripts
    - Add Redis 7 service for BullMQ queues
    - Add MinIO service for S3-compatible storage
    - Configure service networking and volume mounts
    - _Requirements: 1.3, 13.1, 13.2_

  - [x] 2.2 Set up shared package with Drizzle schema
    - Create shared/db/schema.ts with initial table definitions (users, projects, project_users, roles)
    - Configure Drizzle Kit with drizzle.config.ts for migrations
    - Generate initial migration with `drizzle-kit generate`
    - Apply migration with `drizzle-kit migrate`
    - _Requirements: 1.3, 1.6, 1.7_

  - [x] 2.3 Configure drizzle-zod schema generation
    - Install drizzle-zod in shared package
    - Create shared/schemas/ directory for generated Zod schemas
    - Generate Zod schemas from Drizzle tables using createInsertSchema and createSelectSchema
    - Export TypeScript types using z.infer<typeof schema>
    - _Requirements: 1.7, 1.8_

- [x] 3. Backend foundation with Bun and Hono
  - [x] 3.1 Initialize backend package
    - Create backend package with Bun runtime configuration
    - Set up Hono application running on Bun.serve()
    - Configure Pino for structured logging with request IDs
    - Implement CORS and security headers middleware
    - Add health check endpoint at /health
    - _Requirements: 1.1, 1.2, 13.4_

  - [x] 3.2 Set up Drizzle ORM connection
    - Configure Drizzle client with PostgreSQL connection
    - Implement connection pooling and retry logic
    - Create database utilities for transactions
    - Add connection health checks
    - _Requirements: 1.3, 1.6_

  - [x] 3.3 Configure BullMQ and Redis
    - Set up Redis connection with health checks
    - Initialize BullMQ queue manager with default queues
    - Implement queue monitoring and metrics collection
    - Create dead-letter queue handling
    - _Requirements: 6.2_

  - [x] 3.4 Set up MinIO S3 client
    - Configure S3 client for MinIO in development
    - Create StorageService abstraction for file operations
    - Implement upload, download, and delete operations
    - Add presigned URL generation for secure downloads
    - _Requirements: 7.1_

  - [x]* 3.5 Write backend foundation tests
    - Test health check endpoint
    - Test database connection and retry logic
    - Test Redis connection
    - Test MinIO storage operations
    - _Requirements: 1.1, 1.3, 12.1, 12.2_

- [x] 4. Authentication and authorization system
  - [x] 4.1 Extend Drizzle schema for auth
    - Add users, roles, project_users tables to shared/db/schema.ts
    - Generate and apply Drizzle migration
    - Generate Zod schemas with drizzle-zod
    - Export TypeScript types for auth entities
    - _Requirements: 1.6, 1.7, 2.1, 2.3_

  - [x] 4.2 Implement AuthService
    - Create AuthService with login, logout, token generation
    - Implement JWT token generation and validation
    - Add session management with HttpOnly cookies
    - Implement password hashing with bcrypt
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 4.3 Create authentication middleware
    - Implement JWT validation middleware for Agent API routes
    - Create session validation middleware for Dashboard API routes
    - Add request user context injection
    - Implement token refresh logic
    - _Requirements: 2.1, 2.2_

  - [x] 4.4 Implement role-based access control
    - Create authorization middleware with role checking
    - Add project-scoped permission validation
    - Create permission helper utilities
    - Implement role enforcement in route handlers
    - _Requirements: 2.3, 2.4_

  - [x] 4.5 Create authentication API endpoints
    - Implement POST /auth/login with Zod validation
    - Implement POST /auth/logout
    - Implement GET /auth/me with user profile and projects
    - Use @hono/zod-validator for request validation
    - _Requirements: 2.1, 2.2, 2.5_

  - [x]* 4.6 Write authentication tests
    - Test login flow with valid and invalid credentials
    - Test JWT token generation and validation
    - Test session cookie management
    - Test role-based access control
    - _Requirements: 2.1, 2.2, 2.3, 12.1_

- [x] 5. Project management system
  - [x] 5.1 Implement ProjectService
    - Create ProjectService with CRUD operations using Drizzle
    - Implement user-project association management
    - Add project membership queries with joins
    - Implement project-scoped data filtering
    - _Requirements: 2.4, 2.5_

  - [x] 5.2 Create project API endpoints
    - Implement GET /api/v1/dashboard/projects with user filtering
    - Implement POST /api/v1/dashboard/projects with Zod validation
    - Implement GET /api/v1/dashboard/projects/:id with authorization
    - Implement PATCH /api/v1/dashboard/projects/:id with role checking
    - Add project user management endpoints
    - _Requirements: 2.4, 2.5, 10.1_

  - [ ]* 5.3 Write project management tests
    - Test project creation and retrieval
    - Test project membership management
    - Test project-scoped authorization
    - _Requirements: 2.4, 12.1_

- [ ] 6. Agent management system
  - [ ] 6.1 Extend Drizzle schema for agents
    - Add agents, agent_errors, operating_systems tables to schema.ts
    - Include capabilities, hardware_profile as jsonb fields
    - Generate and apply Drizzle migration
    - Generate Zod schemas with drizzle-zod
    - _Requirements: 1.6, 1.7, 3.1, 3.2, 3.3_

  - [ ] 6.2 Implement AgentService
    - Create AgentService with registration and authentication
    - Implement capability detection and storage logic
    - Add heartbeat processing with status tracking
    - Implement agent error logging
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.3 Create Agent API endpoints
    - Implement POST /api/v1/agent/sessions for token authentication
    - Implement POST /api/v1/agent/heartbeat with capability updates
    - Implement POST /api/v1/agent/tasks/next for task pulling
    - Implement POST /api/v1/agent/tasks/:id/report with batch inserts
    - Use Drizzle batch operations or raw Bun.SQL for hash result submissions
    - _Requirements: 4.2, 4.3, 4.5_

  - [ ] 6.4 Create OpenAPI specification for Agent API
    - Define all Agent API endpoints in openapi/agent-api.yaml
    - Document request/response schemas with examples
    - Add authentication and error response definitions
    - Include batch operation schemas for hash submissions
    - _Requirements: 4.1, 4.3_

  - [ ] 6.5 Create Dashboard API endpoints for agents
    - Implement GET /api/v1/dashboard/agents with filtering and pagination
    - Implement GET /api/v1/dashboard/agents/:id with details and metrics
    - Implement PATCH /api/v1/dashboard/agents/:id for status updates
    - Add agent error retrieval endpoints
    - _Requirements: 3.1, 3.2, 3.3, 10.2_

  - [ ]* 6.6 Write agent management tests
    - Test agent registration with capabilities
    - Test heartbeat processing and status updates
    - Test agent error logging
    - Test OpenAPI contract compliance
    - _Requirements: 3.1, 3.2, 3.5, 4.1, 12.1_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Resource management system
  - [ ] 8.1 Extend Drizzle schema for resources
    - Add hash_lists, hash_items, hash_types tables to schema.ts
    - Add word_lists, rule_lists, mask_lists tables
    - Include file_ref as jsonb field for S3 references
    - Generate and apply Drizzle migration
    - Generate Zod schemas with drizzle-zod
    - _Requirements: 1.6, 1.7, 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.2 Implement ResourceService
    - Create file upload handling with multipart forms
    - Implement hash list parsing and validation
    - Add hash type detection integration
    - Implement resource metadata management with Drizzle
    - Store files in MinIO with S3 client
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.3 Create resource API endpoints
    - Implement GET /api/v1/dashboard/resources/hash-lists with filtering
    - Implement POST /api/v1/dashboard/resources/hash-lists with file upload
    - Implement POST /api/v1/dashboard/resources/hash-lists/:id/import for parsing
    - Implement wordlist, rulelist, and masklist endpoints
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.2_

  - [ ]* 8.4 Write resource management tests
    - Test file upload to MinIO
    - Test hash list parsing and validation
    - Test project-scoped resource access
    - _Requirements: 7.1, 7.2, 7.5, 12.1_

- [ ] 9. Hash analysis service
  - [ ] 9.1 Implement HashAnalysisService
    - Integrate name-that-hash library
    - Implement hash type guessing with confidence scores
    - Add hashcat mode mapping logic
    - Implement hash format validation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 9.2 Create hash analysis API endpoint
    - Implement POST /api/v1/dashboard/hashes/guess-type endpoint
    - Add request validation with Zod
    - Return ranked candidate hash types
    - Include hashcat mode numbers in response
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 10.2_

  - [ ]* 9.3 Write hash analysis tests
    - Test hash type detection for common formats
    - Test confidence score ranking
    - Test hashcat mode mapping
    - _Requirements: 9.1, 9.2, 9.3, 12.1_

- [ ] 10. Campaign and attack orchestration
  - [ ] 10.1 Extend Drizzle schema for campaigns
    - Add campaigns, attacks tables to schema.ts
    - Include dependencies as integer array for DAG
    - Add advanced_configuration as jsonb field
    - Generate and apply Drizzle migration
    - Generate Zod schemas with drizzle-zod
    - _Requirements: 1.6, 1.7, 5.1, 5.2, 5.3_

  - [ ] 10.2 Implement CampaignService
    - Create campaign CRUD operations using Drizzle
    - Implement attack configuration and validation
    - Add DAG dependency validation (cycle detection)
    - Implement campaign lifecycle management (start, pause, stop)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 10.3 Create campaign API endpoints
    - Implement GET /api/v1/dashboard/campaigns with filtering
    - Implement POST /api/v1/dashboard/campaigns with validation
    - Implement GET /api/v1/dashboard/campaigns/:id with attack details
    - Implement POST /api/v1/dashboard/campaigns/:id/start, pause, stop
    - Implement attack management endpoints
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 10.2_

  - [ ]* 10.4 Write campaign management tests
    - Test campaign creation with attacks
    - Test DAG validation and cycle detection
    - Test campaign lifecycle transitions
    - _Requirements: 5.1, 5.3, 5.5, 12.1_

- [ ] 11. Task distribution system
  - [ ] 11.1 Extend Drizzle schema for tasks
    - Add tasks table to schema.ts
    - Include work_range, progress, result_stats as jsonb fields
    - Add indexes for hot query paths (status, agent_id, campaign_id)
    - Generate and apply Drizzle migration
    - Generate Zod schemas with drizzle-zod
    - _Requirements: 1.6, 1.7, 6.1, 6.3_

  - [ ] 11.2 Implement TaskDistributionService
    - Create task generation from attack keyspace calculations
    - Implement keyspace partitioning logic
    - Add task assignment logic with agent capability matching
    - Implement task status tracking and updates
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 11.3 Implement queue-based task distribution
    - Create BullMQ queues for pending tasks
    - Implement capability-based queue routing
    - Add task assignment with locking using PostgreSQL
    - Store pending tasks in PostgreSQL with appropriate indexes
    - _Requirements: 6.2, 6.3_

  - [ ] 11.4 Implement task retry and failure handling
    - Add task retry logic with exponential backoff
    - Implement dead-letter queue for failed tasks
    - Add task reassignment for offline agents
    - Create failure reason tracking
    - _Requirements: 6.5_

  - [ ] 11.5 Integrate task distribution with Agent API
    - Wire tasks/next endpoint to queue system
    - Implement task assignment and locking
    - Add progress reporting handling with Drizzle updates
    - Update campaign/attack progress on task completion
    - _Requirements: 4.5, 6.3, 6.4_

  - [ ]* 11.6 Write task distribution tests
    - Test task generation and partitioning
    - Test capability-based task matching
    - Test task retry and failure handling
    - _Requirements: 6.1, 6.2, 6.5, 12.1_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Real-time event system
  - [ ] 13.1 Implement EventService
    - Create event emission and broadcasting logic
    - Implement project-scoped event filtering
    - Add event type definitions and Zod schemas
    - Implement event throttling to prevent overload
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 13.2 Implement WebSocket infrastructure
    - Set up hono/websocket for WebSocket support
    - Implement GET /events/stream endpoint with WebSocket upgrade
    - Add connection management and authentication
    - Implement subscription management by project and event type
    - Add graceful connection handling and reconnection
    - _Requirements: 8.1, 8.3_

  - [ ] 13.3 Integrate events across services
    - Emit agent_status events from AgentService
    - Emit campaign_status events from CampaignService
    - Emit task_update events from TaskDistributionService
    - Emit crack_result events when hashes are cracked
    - _Requirements: 8.2, 8.3_

  - [ ]* 13.4 Write event system tests
    - Test event emission and broadcasting
    - Test project-scoped filtering
    - Test event throttling
    - _Requirements: 8.1, 8.2, 8.4, 12.1_

- [ ] 14. Frontend foundation with React 19 and Vite
  - [ ] 14.1 Initialize frontend package
    - Create Vite + React 19 application with TypeScript
    - Configure Tailwind CSS with custom theme
    - Install and configure shadcn/ui components via CLI
    - Set up TanStack Query v5 for server state management
    - Configure Zustand for client-side UI state
    - _Requirements: 1.4, 14.1, 14.6_

  - [ ] 14.2 Implement authentication UI
    - Create login page with React Hook Form + Zod validation
    - Implement session management on client
    - Add protected route wrapper component
    - Create user profile display component
    - _Requirements: 2.1, 2.2_

  - [ ] 14.3 Create layout and navigation
    - Implement main layout with sidebar using shadcn/ui
    - Add project selector component with Zustand state
    - Create navigation menu with role-based visibility
    - Add user menu with logout
    - _Requirements: 2.4, 14.1, 14.6_

  - [ ]* 14.4 Write frontend foundation tests
    - Test authentication flows with bun:test + Testing Library
    - Test protected routes
    - Test navigation components
    - _Requirements: 2.1, 2.2, 12.3_

- [ ] 15. Dashboard and monitoring UI
  - [ ] 15.1 Implement real-time WebSocket client
    - Create EventContext provider with WebSocket connection
    - Implement event subscription hooks
    - Add automatic reconnection logic
    - Implement fallback to polling when disconnected
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ] 15.2 Create dashboard components
    - Build agent status tiles with real-time updates
    - Create campaign progress cards with percentages
    - Implement recent crack results list
    - Add hash rate trend charts using recharts or similar
    - Integrate with TanStack Query for data fetching
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 15.3 Implement agent list and detail views
    - Create agent list with filtering and status badges
    - Build agent detail page with hardware info
    - Add agent performance metrics display
    - Show recent agent errors
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 15.4 Write dashboard UI tests
    - Test real-time updates with bun:test + Testing Library
    - Test dashboard component rendering
    - Test agent list filtering
    - _Requirements: 8.3, 14.1, 14.5, 12.3_

- [ ] 16. Campaign creation wizard
  - [ ] 16.1 Implement wizard framework
    - Create multi-step wizard component with Zustand state
    - Add progress indicator and navigation
    - Implement step validation with Zod schemas
    - Add summary preview step
    - _Requirements: 15.1, 15.5_

  - [ ] 16.2 Create campaign configuration steps
    - Build basic info form (name, description, priority)
    - Create hash list selection/upload step
    - Implement attack configuration forms with mode-specific fields
    - Add DAG editor with drag-and-drop using react-flow or similar
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 16.3 Implement form validation
    - Use shared Zod schemas from drizzle-zod for validation
    - Integrate React Hook Form with Zod resolvers
    - Add real-time validation feedback
    - Validate attack configurations against hashcat modes
    - _Requirements: 15.3, 15.4_

  - [ ] 16.4 Wire wizard to backend API
    - Implement campaign creation submission with TanStack Query
    - Add file upload handling for hash lists
    - Handle validation errors from backend
    - Show success confirmation and redirect
    - _Requirements: 15.1, 15.2, 15.5_

  - [ ]* 16.5 Write campaign wizard tests
    - Test wizard navigation and validation with bun:test + Testing Library
    - Test campaign creation flow
    - Test file upload handling
    - _Requirements: 15.1, 15.3, 15.5, 12.3_

- [ ] 17. Campaign and attack management UI
  - [ ] 17.1 Create campaign list view
    - Build campaign list with status badges
    - Add filtering by status and project
    - Implement sorting and pagination
    - Show campaign progress indicators
    - _Requirements: 5.1, 14.2_

  - [ ] 17.2 Implement campaign detail view
    - Display campaign metadata and status
    - Show attack list with DAG visualization
    - Add campaign control buttons (start, pause, stop)
    - Display real-time progress updates via WebSocket
    - _Requirements: 5.1, 5.5, 14.2, 14.5_

  - [ ] 17.3 Create attack editor
    - Build attack configuration form with React Hook Form
    - Add resource selection dropdowns
    - Implement mode-specific field visibility
    - Add attack dependency editor
    - _Requirements: 5.2, 5.3, 15.3_

  - [ ]* 17.4 Write campaign UI tests
    - Test campaign list and filtering with bun:test + Testing Library
    - Test campaign detail view
    - Test attack editor
    - _Requirements: 5.1, 5.2, 12.3_

- [ ] 18. Resource management UI
  - [ ] 18.1 Create resource browser
    - Build tabbed interface for resource types using shadcn/ui tabs
    - Implement resource list with metadata
    - Add filtering and search
    - Show resource usage in campaigns
    - _Requirements: 7.1, 7.5_

  - [ ] 18.2 Implement resource upload flows
    - Create hash list upload form with preview
    - Add wordlist/rulelist/masklist upload
    - Implement drag-and-drop file upload
    - Show upload progress and validation
    - _Requirements: 7.2, 7.3, 7.4, 15.2_

  - [ ] 18.3 Add hash type detection UI
    - Create hash type guessing interface
    - Display candidate types with confidence scores
    - Allow manual hash type selection
    - Integrate with hash list upload flow
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ]* 18.4 Write resource UI tests
    - Test resource browser and filtering with bun:test + Testing Library
    - Test file upload flows
    - Test hash type detection
    - _Requirements: 7.1, 7.2, 9.1, 12.3_

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Data migration tooling
  - [ ] 20.1 Create Rails export scripts
    - Write export script for users and projects
    - Create export script for agents and capabilities
    - Implement export for campaigns, attacks, tasks
    - Add export for resources and hash lists
    - Export to NDJSON format for processing
    - _Requirements: 11.1_

  - [ ] 20.2 Implement transformation logic
    - Create user transformation with password hash mapping
    - Implement project and membership transformation
    - Add agent capability transformation
    - Transform campaign/attack relationships with ID mapping
    - _Requirements: 11.2, 11.5_

  - [ ] 20.3 Create PostgreSQL import scripts
    - Implement idempotent import using Drizzle batch operations
    - Add ID mapping between Rails and PostgreSQL
    - Handle relationship references with foreign keys
    - Implement batch import for performance
    - _Requirements: 11.2, 11.3_

  - [ ] 20.4 Add migration validation
    - Implement count validation for all entities
    - Add relationship integrity checks using Drizzle queries
    - Validate DAG structures
    - Create migration report generation
    - _Requirements: 11.4, 11.5_

  - [ ]* 20.5 Write migration tests
    - Test export scripts with sample data
    - Test transformation logic
    - Test import idempotency
    - _Requirements: 11.2, 11.3, 11.4, 12.1_

- [ ] 21. Testing infrastructure and E2E tests
  - [ ] 21.1 Set up backend test infrastructure
    - Configure bun:test for backend unit and integration tests
    - Set up Testcontainers for PostgreSQL, Redis, MinIO
    - Create test database seeding utilities
    - Implement test fixtures and factories
    - _Requirements: 1.8, 12.1, 12.2_

  - [ ] 21.2 Set up frontend test infrastructure
    - Configure bun:test with Testing Library for component tests
    - Set up Playwright for E2E tests
    - Create test utilities and custom matchers
    - Implement mock API server for component tests
    - _Requirements: 1.8, 12.3, 12.4_

  - [ ] 21.3 Implement API contract testing
    - Set up OpenAPI validation in tests
    - Create contract tests for Agent API
    - Add contract tests for Dashboard API
    - Validate request/response schemas against OpenAPI spec
    - _Requirements: 4.1, 12.5_

  - [ ]* 21.4 Write E2E test suites
    - Create authentication E2E tests with Playwright
    - Implement campaign creation E2E tests
    - Add agent management E2E tests
    - Test real-time updates E2E
    - _Requirements: 12.4, 12.5_

- [ ] 22. Deployment and operations
  - [ ] 22.1 Create Docker images
    - Build optimized Bun backend image
    - Create Vite production build image for frontend
    - Add health check endpoints
    - Implement graceful shutdown handling
    - _Requirements: 13.1, 13.3_

  - [ ] 22.2 Create deployment configurations
    - Write production docker-compose.yml
    - Configure environment-specific settings
    - Implement secrets management
    - Add database migration scripts for deployment
    - _Requirements: 13.1, 13.2_

  - [ ] 22.3 Implement logging and monitoring
    - Configure structured logging with Pino
    - Add request/response logging middleware
    - Implement error tracking and alerting
    - Create performance metrics collection
    - _Requirements: 13.4_

  - [ ] 22.4 Add operational tooling
    - Create database backup scripts
    - Implement health check monitoring
    - Add deployment scripts
    - Create troubleshooting documentation
    - _Requirements: 13.3, 13.5_

  - [ ]* 22.5 Write deployment tests
    - Test Docker image builds
    - Test health check endpoints
    - Validate environment configurations
    - _Requirements: 13.1, 13.3_

- [ ] 23. Integration and final validation
  - [ ] 23.1 Perform end-to-end integration testing
    - Test complete campaign workflow from creation to completion
    - Validate agent registration and task execution
    - Test real-time updates across all components
    - Verify resource management workflows
    - _Requirements: 11.5, 12.4, 12.5_

  - [ ] 23.2 Conduct performance testing
    - Load test API endpoints with concurrent requests
    - Test task distribution with multiple agents
    - Validate real-time event performance
    - Measure database query performance with Drizzle
    - _Requirements: 6.2, 8.4_

  - [ ] 23.3 Execute migration dry run
    - Run full migration with production-like data
    - Validate all data transformations
    - Test agent cutover procedure
    - Document migration issues and resolutions
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 23.4 Create documentation
    - Write API documentation from OpenAPI specs
    - Create operator user guide
    - Document deployment procedures
    - Add troubleshooting guide
    - _Requirements: 4.1, 13.5_

## Notes

- Tasks marked with `*` are optional test-related sub-tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Drizzle table definitions in `shared/db/schema.ts` are the single source of truth
- All Zod schemas are generated from Drizzle tables using drizzle-zod
- TypeScript types are inferred from Zod schemas using `z.infer<typeof schema>`
- Use bun:test for all tests (backend unit/integration, frontend component tests)
- Use Testcontainers for integration tests with PostgreSQL, Redis, and MinIO
- Use Playwright for E2E tests
- Agent API uses batch operations with Drizzle batch inserts or raw Bun.SQL for performance
- Dashboard API uses standard REST patterns for low-traffic usage (1-3 concurrent users)
