# Implementation Plan

- [x] 1. Project foundation and infrastructure setup

  - Initialize monorepo structure with backend, frontend, and shared directories
  - Configure TypeScript for all packages with strict mode and shared tsconfig
  - Set up ESLint and Prettier with consistent rules across packages
  - Create Docker Compose configuration for MongoDB, Redis, and MinIO
  - Configure environment variable management with dotenv and validation
  - _Requirements: 1.1, 1.2, 13.1, 13.2_

- [-] 2. Backend core infrastructure
  - [x] 2.1 Set up Express server with TypeScript
    - Create Express application with middleware pipeline
    - Implement request logging with Pino and request ID generation
    - Configure CORS and security headers
    - Set up health check endpoint at /health
    - _Requirements: 1.1, 13.4_

  - [ ] 2.2 Implement MongoDB connection and base models
    - Configure Mongoose with TypeScript type inference
    - Create base schema with timestamps and soft delete support
    - Implement connection management with retry logic
    - Set up database indexes for common query patterns
    - _Requirements: 1.1, 1.3_

  - [ ] 2.3 Set up Redis and BullMQ infrastructure
    - Configure Redis connection with health checks
    - Initialize BullMQ queue manager with default queues
    - Implement queue monitoring and metrics collection
    - Create dead-letter queue handling
    - _Requirements: 1.3, 6.2_

  - [ ] 2.4 Implement S3/MinIO storage service
    - Configure S3 client with MinIO for development
    - Create StorageService abstraction for file operations
    - Implement upload, download, and delete operations
    - Add presigned URL generation for secure downloads
    - _Requirements: 1.4, 7.1_

- [ ] 3. Authentication and authorization system
  - [ ] 3.1 Implement user model and authentication service
    - Create User Mongoose model with password hashing
    - Implement AuthService with login, logout, and token generation
    - Add JWT token generation and validation
    - Implement session management with HttpOnly cookies
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 3.2 Create authentication middleware
    - Implement JWT validation middleware for API routes
    - Create session validation middleware for web routes
    - Add request user context injection
    - Implement token refresh logic
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Implement role-based access control
    - Create Role and ProjectUser models
    - Implement authorization middleware with role checking
    - Add project-scoped permission validation
    - Create permission helper utilities
    - _Requirements: 2.3, 2.4_

  - [ ] 3.4 Write authentication tests
    - Test login flow with valid and invalid credentials
    - Test JWT token generation and validation
    - Test session cookie management
    - Test role-based access control
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Project management system
  - [ ] 4.1 Implement project models and service
    - Create Project and ProjectUser Mongoose models
    - Implement ProjectService with CRUD operations
    - Add user-project association management
    - Implement project membership queries
    - _Requirements: 2.4, 2.5_

  - [ ] 4.2 Create project API endpoints
    - Implement GET /projects with user filtering
    - Implement POST /projects with validation
    - Implement GET /projects/:id with authorization
    - Implement PATCH /projects/:id with role checking
    - Implement project user management endpoints
    - _Requirements: 2.4, 2.5_

  - [ ] 4.3 Write project management tests
    - Test project creation and retrieval
    - Test project membership management
    - Test project-scoped authorization
    - _Requirements: 2.4_

- [ ] 5. Agent management system
  - [ ] 5.1 Implement agent models and service
    - Create Agent, AgentError, and OperatingSystem models
    - Implement AgentService with registration and heartbeat
    - Add capability detection and storage logic
    - Implement agent status tracking and transitions
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.2 Create Agent API endpoints
    - Implement POST /agent/sessions for authentication
    - Implement POST /agent/heartbeat with capability updates
    - Implement POST /agent/tasks/next for task pulling
    - Implement POST /agent/tasks/:id/report for progress updates
    - _Requirements: 4.2, 4.5_

  - [ ] 5.3 Create OpenAPI specification for Agent API
    - Define all Agent API endpoints in openapi/agent-api.yaml
    - Document request/response schemas with examples
    - Add authentication and error response definitions
    - Include hashcat 6.x and 7.x capability flags
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ] 5.4 Implement agent web UI endpoints
    - Implement GET /agents with filtering and pagination
    - Implement GET /agents/:id with details and metrics
    - Implement PATCH /agents/:id for status updates
    - Add agent error retrieval endpoints
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 5.5 Write agent management tests
    - Test agent registration with capabilities
    - Test heartbeat processing and status updates
    - Test agent error logging
    - Test OpenAPI contract compliance
    - _Requirements: 3.1, 3.2, 3.5, 4.1_

- [ ] 6. Resource management system
  - [ ] 6.1 Implement resource models
    - Create HashList, HashItem, HashType models
    - Create WordList, RuleList, MaskList models
    - Add file reference and metadata fields
    - Implement project-scoped queries
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 6.2 Implement ResourceService
    - Create file upload handling with multipart forms
    - Implement hash list parsing and validation
    - Add hash type detection integration
    - Implement resource metadata management
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 6.3 Create resource API endpoints
    - Implement GET /resources/hash-lists with filtering
    - Implement POST /resources/hash-lists with file upload
    - Implement POST /resources/hash-lists/:id/import for parsing
    - Implement wordlist, rulelist, and masklist endpoints
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 6.4 Write resource management tests
    - Test file upload to S3/MinIO
    - Test hash list parsing and validation
    - Test project-scoped resource access
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 7. Hash analysis service
  - [ ] 7.1 Implement HashAnalysisService
    - Integrate name-that-hash library
    - Implement hash type guessing with confidence scores
    - Add hashcat mode mapping logic
    - Implement hash format validation
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 7.2 Create hash analysis API endpoint
    - Implement POST /hashes/guess-type endpoint
    - Add request validation with Zod
    - Return ranked candidate hash types
    - Include hashcat mode numbers in response
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ] 7.3 Write hash analysis tests
    - Test hash type detection for common formats
    - Test confidence score ranking
    - Test hashcat mode mapping
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 8. Campaign and attack management
  - [ ] 8.1 Implement campaign and attack models
    - Create Campaign and Attack Mongoose models
    - Add DAG dependency fields and validation
    - Implement status tracking and transitions
    - Add keyspace and configuration fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 8.2 Implement CampaignService
    - Create campaign CRUD operations
    - Implement attack configuration and validation
    - Add DAG dependency validation (cycle detection)
    - Implement campaign lifecycle management (start, pause, stop)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 8.3 Create campaign API endpoints
    - Implement GET /campaigns with filtering
    - Implement POST /campaigns with validation
    - Implement GET /campaigns/:id with attack details
    - Implement POST /campaigns/:id/start, pause, stop
    - Implement attack management endpoints
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ] 8.4 Write campaign management tests
    - Test campaign creation with attacks
    - Test DAG validation and cycle detection
    - Test campaign lifecycle transitions
    - _Requirements: 5.1, 5.3, 5.5_

- [ ] 9. Task distribution system
  - [ ] 9.1 Implement task model and service
    - Create Task Mongoose model with work ranges
    - Implement TaskDistributionService
    - Add keyspace calculation and partitioning logic
    - Implement task generation from attacks
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 9.2 Implement queue-based task distribution
    - Create BullMQ queues for pending tasks
    - Implement capability-based queue routing
    - Add task assignment logic with agent matching
    - Implement task status tracking and updates
    - _Requirements: 6.2, 6.3, 6.4_

  - [ ] 9.3 Implement task retry and failure handling
    - Add task retry logic with exponential backoff
    - Implement dead-letter queue for failed tasks
    - Add task reassignment for offline agents
    - Create failure reason tracking
    - _Requirements: 6.5_

  - [ ] 9.4 Integrate task distribution with Agent API
    - Wire tasks/next endpoint to queue system
    - Implement task assignment and locking
    - Add progress reporting handling
    - Update campaign/attack progress on task completion
    - _Requirements: 4.5, 6.3, 6.4_

  - [ ] 9.5 Write task distribution tests
    - Test task generation and partitioning
    - Test capability-based task matching
    - Test task retry and failure handling
    - _Requirements: 6.1, 6.2, 6.5_

- [ ] 10. Real-time event system
  - [ ] 10.1 Implement EventService
    - Create event emission and broadcasting logic
    - Implement project-scoped event filtering
    - Add event type definitions and schemas
    - Implement event throttling to prevent overload
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 10.2 Implement WebSocket/SSE infrastructure
    - Set up WebSocket server or SSE endpoint
    - Implement connection management and authentication
    - Add subscription management by project and event type
    - Implement graceful connection handling and reconnection
    - _Requirements: 8.1, 8.3_

  - [ ] 10.3 Integrate events across services
    - Emit agent_status events from AgentService
    - Emit campaign_status events from CampaignService
    - Emit task_update events from TaskDistributionService
    - Emit crack_result events when hashes are cracked
    - _Requirements: 8.2, 8.3_

  - [ ] 10.4 Write event system tests
    - Test event emission and broadcasting
    - Test project-scoped filtering
    - Test event throttling
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 11. Control API for automation
  - [ ] 11.1 Create Control API endpoints
    - Implement POST /control/campaigns for creation
    - Implement GET /control/campaigns/:id/status
    - Implement POST /control/resources/import
    - Implement GET /control/agents/status
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ] 11.2 Implement idempotent operations
    - Add idempotency keys for create operations
    - Implement PUT operations for updates
    - Add conflict detection and handling
    - _Requirements: 10.3_

  - [ ] 11.3 Add pagination and filtering
    - Implement cursor-based pagination
    - Add filtering by project, status, date ranges
    - Implement stable sorting for consistent results
    - _Requirements: 10.5_

  - [ ] 11.4 Write Control API tests
    - Test automation workflows
    - Test idempotency
    - Test pagination and filtering
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ] 12. Frontend foundation
  - [ ] 12.1 Initialize Next.js application
    - Create Next.js app with App Router
    - Configure TypeScript and Tailwind CSS
    - Set up shadcn/ui component library
    - Configure React Query for data fetching
    - _Requirements: 1.2, 14.1_

  - [ ] 12.2 Implement authentication UI
    - Create login page with form validation
    - Implement session management on client
    - Add protected route wrapper
    - Create user profile display
    - _Requirements: 2.1, 2.2_

  - [ ] 12.3 Create layout and navigation
    - Implement main layout with sidebar
    - Add project selector component
    - Create navigation menu with role-based visibility
    - Add user menu with logout
    - _Requirements: 2.4, 14.1_

  - [ ] 12.4 Write frontend foundation tests
    - Test authentication flows
    - Test protected routes
    - Test navigation components
    - _Requirements: 2.1, 2.2_

- [ ] 13. Dashboard and monitoring UI
  - [ ] 13.1 Implement real-time event client
    - Create EventContext provider with WebSocket/SSE
    - Implement event subscription hooks
    - Add automatic reconnection logic
    - Implement fallback to polling when disconnected
    - _Requirements: 8.1, 8.3, 8.5_

  - [ ] 13.2 Create dashboard components
    - Build agent status tiles with real-time updates
    - Create campaign progress cards with percentages
    - Implement recent crack results list
    - Add hash rate trend charts
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 13.3 Implement agent list and detail views
    - Create agent list with filtering and status badges
    - Build agent detail page with hardware info
    - Add agent performance metrics display
    - Show recent agent errors
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 13.4 Write dashboard UI tests
    - Test real-time updates
    - Test dashboard component rendering
    - Test agent list filtering
    - _Requirements: 8.3, 14.1, 14.5_

- [ ] 14. Campaign creation wizard
  - [ ] 14.1 Implement wizard framework
    - Create multi-step wizard component
    - Add progress indicator and navigation
    - Implement step validation and state management
    - Add summary preview step
    - _Requirements: 15.1, 15.5_

  - [ ] 14.2 Create campaign configuration steps
    - Build basic info form (name, description, priority)
    - Create hash list selection/upload step
    - Implement attack configuration forms
    - Add DAG editor with drag-and-drop
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 14.3 Implement form validation
    - Add Zod schemas for each wizard step
    - Implement React Hook Form integration
    - Add real-time validation feedback
    - Validate attack configurations against hashcat modes
    - _Requirements: 15.3, 15.4_

  - [ ] 14.4 Wire wizard to backend API
    - Implement campaign creation submission
    - Add file upload handling for hash lists
    - Handle validation errors from backend
    - Show success confirmation and redirect
    - _Requirements: 15.1, 15.2, 15.5_

  - [ ] 14.5 Write campaign wizard tests
    - Test wizard navigation and validation
    - Test campaign creation flow
    - Test file upload handling
    - _Requirements: 15.1, 15.3, 15.5_

- [ ] 15. Campaign and attack management UI
  - [ ] 15.1 Create campaign list view
    - Build campaign list with status badges
    - Add filtering by status and project
    - Implement sorting and pagination
    - Show campaign progress indicators
    - _Requirements: 5.1, 14.2_

  - [ ] 15.2 Implement campaign detail view
    - Display campaign metadata and status
    - Show attack list with DAG visualization
    - Add campaign control buttons (start, pause, stop)
    - Display real-time progress updates
    - _Requirements: 5.1, 5.5, 14.2, 14.5_

  - [ ] 15.3 Create attack editor
    - Build attack configuration form
    - Add resource selection dropdowns
    - Implement mode-specific field visibility
    - Add attack dependency editor
    - _Requirements: 5.2, 5.3, 15.3_

  - [ ] 15.4 Write campaign UI tests
    - Test campaign list and filtering
    - Test campaign detail view
    - Test attack editor
    - _Requirements: 5.1, 5.2_

- [ ] 16. Resource management UI
  - [ ] 16.1 Create resource browser
    - Build tabbed interface for resource types
    - Implement resource list with metadata
    - Add filtering and search
    - Show resource usage in campaigns
    - _Requirements: 7.1, 7.5_

  - [ ] 16.2 Implement resource upload flows
    - Create hash list upload form with preview
    - Add wordlist/rulelist/masklist upload
    - Implement drag-and-drop file upload
    - Show upload progress and validation
    - _Requirements: 7.2, 7.3, 7.4, 15.2_

  - [ ] 16.3 Add hash type detection UI
    - Create hash type guessing interface
    - Display candidate types with confidence
    - Allow manual hash type selection
    - Integrate with hash list upload
    - _Requirements: 9.1, 9.2, 9.5_

  - [ ] 16.4 Write resource UI tests
    - Test resource browser and filtering
    - Test file upload flows
    - Test hash type detection
    - _Requirements: 7.1, 7.2, 9.1_

- [ ] 17. Data migration tooling
  - [ ] 17.1 Create Rails export scripts
    - Write export script for users and projects
    - Create export script for agents and capabilities
    - Implement export for campaigns, attacks, tasks
    - Add export for resources and hash lists
    - _Requirements: 11.1_

  - [ ] 17.2 Implement transformation logic
    - Create user transformation with password hash mapping
    - Implement project and membership transformation
    - Add agent capability transformation
    - Transform campaign/attack relationships
    - _Requirements: 11.2, 11.5_

  - [ ] 17.3 Create MongoDB import scripts
    - Implement idempotent import for all collections
    - Add ID mapping between Rails and MongoDB
    - Handle relationship references
    - Implement batch import for performance
    - _Requirements: 11.2, 11.3_

  - [ ] 17.4 Add migration validation
    - Implement count validation for all entities
    - Add relationship integrity checks
    - Validate DAG structures
    - Create migration report generation
    - _Requirements: 11.4, 11.5_

  - [ ] 17.5 Write migration tests
    - Test export scripts with sample data
    - Test transformation logic
    - Test import idempotency
    - _Requirements: 11.2, 11.3, 11.4_

- [ ] 18. Testing infrastructure
  - [ ] 18.1 Set up backend test infrastructure
    - Configure Jest with TypeScript
    - Set up Testcontainers for MongoDB, Redis, MinIO
    - Create test database seeding utilities
    - Implement test fixtures and factories
    - _Requirements: 12.1, 12.2_

  - [ ] 18.2 Set up frontend test infrastructure
    - Configure Jest with React Testing Library
    - Set up Playwright for E2E tests
    - Create test utilities and custom matchers
    - Implement mock API server for component tests
    - _Requirements: 12.3, 12.4_

  - [ ] 18.3 Implement API contract testing
    - Set up OpenAPI validation in tests
    - Create contract tests for Agent API
    - Add contract tests for Web API
    - Validate request/response schemas
    - _Requirements: 4.1, 12.5_

  - [ ] 18.4 Write E2E test suites
    - Create authentication E2E tests
    - Implement campaign creation E2E tests
    - Add agent management E2E tests
    - Test real-time updates E2E
    - _Requirements: 12.4, 12.5_

- [ ] 19. Deployment and operations
  - [ ] 19.1 Create Docker images
    - Build optimized Node.js API image
    - Create Next.js production image
    - Add health check endpoints
    - Implement graceful shutdown handling
    - _Requirements: 13.1, 13.3_

  - [ ] 19.2 Create deployment configurations
    - Write production docker-compose.yml
    - Add Kubernetes manifests (optional)
    - Configure environment-specific settings
    - Implement secrets management
    - _Requirements: 13.1, 13.2_

  - [ ] 19.3 Implement logging and monitoring
    - Configure structured logging with Pino
    - Add request/response logging
    - Implement error tracking and alerting
    - Create performance metrics collection
    - _Requirements: 13.4_

  - [ ] 19.4 Add operational tooling
    - Create database backup scripts
    - Implement health check monitoring
    - Add deployment scripts
    - Create troubleshooting documentation
    - _Requirements: 13.3, 13.5_

  - [ ] 19.5 Write deployment tests
    - Test Docker image builds
    - Test health check endpoints
    - Validate environment configurations
    - _Requirements: 13.1, 13.3_

- [ ] 20. Integration and final validation
  - [ ] 20.1 Perform end-to-end integration testing
    - Test complete campaign workflow from creation to completion
    - Validate agent registration and task execution
    - Test real-time updates across all components
    - Verify resource management workflows
    - _Requirements: 11.5, 12.4, 12.5_

  - [ ] 20.2 Conduct performance testing
    - Load test API endpoints with concurrent requests
    - Test task distribution with multiple agents
    - Validate real-time event performance
    - Measure database query performance
    - _Requirements: 6.2, 8.4_

  - [ ] 20.3 Execute migration dry run
    - Run full migration with production-like data
    - Validate all data transformations
    - Test agent cutover procedure
    - Document migration issues and resolutions
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 20.4 Create documentation
    - Write API documentation from OpenAPI specs
    - Create operator user guide
    - Document deployment procedures
    - Add troubleshooting guide
    - _Requirements: 4.1, 13.5_
