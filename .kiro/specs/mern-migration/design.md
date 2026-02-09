# Design Document

## Overview

HashHive is a greenfield MERN implementation that replaces the Rails-based CipherSwarm platform. The system orchestrates distributed password cracking across multiple agents using hashcat, providing campaign management, intelligent task distribution, real-time monitoring, and comprehensive resource management. The architecture uses TypeScript throughout, with **Fastify** for high-performance HTTP, **MongoDB** for data persistence, **BullMQ/Redis** for job queuing, **S3-compatible storage** (MinIO) for binary artifacts, and **React 19 + Vite** for the operator-facing web UI.

**Key Architectural Principles:**

- **Zod schemas as single source of truth**: All data shapes defined in `shared/` package, types inferred via `z.infer<typeof schema>`
- **No premature abstraction**: Fastify route handlers can call Mongoose models directly; service layers only when needed
- **Bulk operations for Agent API**: Use `insertMany()` and `bulkWrite({ ordered: false })` for hash submissions
- **High-throughput Agent API**: Must handle 10K req/s bursts with write concern `{ w: 1, j: false }`
- **Low-traffic Dashboard API**: Standard REST for 1-3 concurrent users
- **Real-time via WebSockets**: @fastify/websocket for dashboard updates (agent heartbeats, crack results)
- **Turborepo + pnpm**: Monorepo with workspace packages (backend, frontend, shared, openapi)

## Architecture

### High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     Operator/Admin Users                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         React 19 + Vite Frontend (TypeScript)                │
│  - TanStack Query v5 for server state                        │
│  - Zustand for client UI state                               │
│  - WebSocket client for real-time updates                    │
│  - shadcn/ui components (copied into project)                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Node.js Backend (Fastify + TypeScript)               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Layer (Fastify Routes)                         │    │
│  │  - Dashboard API (/api/v1/dashboard/*)              │    │
│  │    Session-based auth, 1-3 concurrent users         │    │
│  │  - Agent API (/api/v1/agent/*)                      │    │
│  │    Token-based auth, 10K req/s bursts               │    │
│  │    Bulk operations (insertMany, bulkWrite)          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Service Layer (Optional - only when needed)        │    │
│  │  - AuthService, AgentService                        │    │
│  │  - CampaignService, TaskDistributionService         │    │
│  │  - ResourceService, HashAnalysisService             │    │
│  │  - EventService (WebSocket broadcasting)            │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Data Access Layer (Mongoose Models)                │    │
│  │  - Direct calls from routes when simple             │    │
│  │  - Compound indexes for hot query paths             │    │
│  │  - Write concern: { w: 1, j: false } for Agent API  │    │
│  └─────────────────────────────────────────────────────┘    │
└──┴─────────────────────────────────────────────────────┴────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  MongoDB    │    │ Redis/BullMQ│    │ MinIO (S3)  │
│  (Primary   │    │ (Queues &   │    │ (Binary     │
│   Data)     │    │  Pub/Sub)   │    │  Artifacts) │
└─────────────┘    └─────────────┘    └─────────────┘
                           ▲
                           │ Task Pull (REST)
                           │
                    ┌──────┴──────┐
                    │ Go-based    │
                    │ Agents      │
                    │ (Hashcat)   │
                    └─────────────┘
```

### Technology Stack

**Backend:**

- Node.js LTS with TypeScript (for MongoDB driver compatibility)
- Fastify for HTTP server (high-performance, schema-based validation)
- Mongoose for MongoDB ODM
- Zod for all data shapes (single source of truth in `shared/` package)
- BullMQ for job queues
- Pino for structured logging
- @fastify/websocket for real-time updates

**Frontend:**

- React 19 with TypeScript
- Vite for build tooling (not Next.js, not CRA)
- Tailwind CSS for styling
- shadcn/ui for components (copied into project via CLI)
- React Hook Form + Zod resolvers for forms
- TanStack Query v5 for all server state
- Zustand for client-side UI state (no Redux, no Context API)
- WebSocket client for real-time updates

**Infrastructure:**

- MongoDB 6+ for document storage
- Redis 7+ for caching and queues
- MinIO (S3-compatible) for objects
- Docker Compose for local development (MongoDB, Redis, MinIO)

**Tooling:**

- pnpm for package management (exclusively)
- Turborepo for monorepo orchestration and caching
- Vitest for all tests (no Jest)
- Testcontainers for integration tests
- Oxlint for linting (fallback to Biome if needed)
- Oxfmt/Prettier for formatting

## Components and Interfaces

### Backend Service Modules

#### 1. AuthService

**Responsibilities:**

- User authentication (login, logout, token generation)
- Session management with HttpOnly cookies
- JWT token validation for API requests
- Password hashing and verification

**Key Methods:**

- `login(email, password): Promise<{ user, token, session }>`
- `validateToken(token): Promise<User>`
- `validateSession(sessionId): Promise<User>`
- `logout(sessionId): Promise<void>`

**Dependencies:**

- User model (Mongoose)
- bcrypt for password hashing
- jsonwebtoken for JWT operations

#### 2. ProjectService

**Responsibilities:**

- Project CRUD operations
- Project membership management
- Role assignment and validation
- Project-scoped data filtering

**Key Methods:**

- `createProject(data): Promise<Project>`
- `addUserToProject(projectId, userId, roles): Promise<void>`
- `getUserProjects(userId): Promise<Project[]>`
- `validateProjectAccess(userId, projectId, requiredRole): Promise<boolean>`

**Dependencies:**

- Project, ProjectUser, Role models
- AuthService for user validation

#### 3. AgentService

**Responsibilities:**

- Agent registration and authentication
- Capability detection and storage
- Heartbeat processing and status tracking
- Agent error logging

**Key Methods:**

- `registerAgent(credentials, capabilities): Promise<Agent>`
- `processHeartbeat(agentId, status, deviceInfo): Promise<void>`
- `getAgentsByProject(projectId, filters): Promise<Agent[]>`
- `logAgentError(agentId, error): Promise<void>`

**Dependencies:**

- Agent, AgentError, OperatingSystem models
- EventService for status broadcasts

#### 4. CampaignService

**Responsibilities:**

- Campaign lifecycle management
- Attack configuration and validation
- DAG dependency resolution
- Campaign execution orchestration

**Key Methods:**

- `createCampaign(projectId, config): Promise<Campaign>`
- `addAttack(campaignId, attackConfig): Promise<Attack>`
- `validateAttackDAG(campaignId): Promise<boolean>`
- `startCampaign(campaignId): Promise<void>`
- `pauseCampaign(campaignId): Promise<void>`

**Dependencies:**

- Campaign, Attack models
- TaskDistributionService for task generation
- HashAnalysisService for validation

#### 5. TaskDistributionService

**Responsibilities:**

- Task generation from attack keyspace
- Queue management with BullMQ
- Intelligent task assignment
- Task progress tracking

**Key Methods:**

- `generateTasks(attackId): Promise<Task[]>`
- `enqueueTask(task, capabilities): Promise<void>`
- `getNextTask(agentId, capabilities): Promise<Task | null>`
- `reportTaskProgress(taskId, progress): Promise<void>`
- `handleTaskFailure(taskId, reason): Promise<void>`

**Dependencies:**

- Task, Attack models
- BullMQ for queue operations
- AgentService for capability matching

#### 6. ResourceService

**Responsibilities:**

- Resource metadata management
- File upload to object storage
- Hash list parsing and validation
- Resource access control

**Key Methods:**

- `uploadHashList(projectId, file, metadata): Promise<HashList>`
- `parseHashList(hashListId): Promise<void>`
- `uploadWordlist(projectId, file, metadata): Promise<WordList>`
- `getResourcesByProject(projectId, type): Promise<Resource[]>`

**Dependencies:**

- HashList, WordList, RuleList, MaskList models
- S3 client for object storage
- HashAnalysisService for hash type detection

#### 7. HashAnalysisService

**Responsibilities:**

- Hash type identification
- Hashcat mode mapping
- Hash format validation

**Key Methods:**

- `guessHashType(hashContent): Promise<HashTypeGuess[]>`
- `validateHashFormat(hash, hashcatMode): Promise<boolean>`
- `getHashcatModeInfo(mode): Promise<HashType>`

**Dependencies:**

- HashType model
- name-that-hash library integration

#### 8. EventService

**Responsibilities:**

- Real-time event broadcasting
- WebSocket/SSE connection management
- Event filtering and routing
- Event persistence for replay

**Key Methods:**

- `broadcast(event): Promise<void>`
- `broadcastToProject(projectId, event): Promise<void>`
- `subscribe(userId, projectId, eventTypes): EventStream`
- `unsubscribe(connectionId): Promise<void>`

**Dependencies:**

- WebSocket or SSE infrastructure
- Redis for pub/sub

### API Endpoints

#### Dashboard API (/api/v1/dashboard/*)

**Authentication:** Session-based (HttpOnly cookies)
**Traffic:** Low (1-3 concurrent users)
**Pattern:** Standard REST CRUD operations

**Authentication:**

```typescript
POST /auth/login
  Body: { email, password }
  Response: { user, token, session }

POST /auth/logout
  Response: { success: true }

GET /auth/me
  Response: { user, projects, roles }
```

**Projects:**

```typescript
GET /projects
  Response: { projects: Project[] }

POST /projects
  Body: { name, description, settings }
  Response: { project: Project }

GET /projects/:id
  Response: { project: Project }

PATCH /projects/:id
  Body: Partial<Project>
  Response: { project: Project }
```

**Agents:**

```typescript
GET /agents?projectId=:id&status=:status
  Response: { agents: Agent[], pagination }

GET /agents/:id
  Response: { agent: Agent, recentErrors, performance }

PATCH /agents/:id
  Body: { status, priority }
  Response: { agent: Agent }
```

**Campaigns:**

```typescript
GET /campaigns?projectId=:id
  Response: { campaigns: Campaign[], pagination }

POST /campaigns
  Body: { projectId, name, hashListId, attacks }
  Response: { campaign: Campaign }

GET /campaigns/:id
  Response: { campaign: Campaign, attacks, progress }

POST /campaigns/:id/start
  Response: { campaign: Campaign }

POST /campaigns/:id/pause
  Response: { campaign: Campaign }
```

**Resources:**

```typescript
GET /resources/hash-lists?projectId=:id
  Response: { hashLists: HashList[] }

POST /resources/hash-lists
  Body: FormData (file + metadata)
  Response: { hashList: HashList }

POST /resources/hash-lists/:id/import
  Response: { job: ImportJob }

GET /resources/word-lists?projectId=:id
  Response: { wordLists: WordList[] }

POST /resources/word-lists
  Body: FormData (file + metadata)
  Response: { wordList: WordList }
```

**Hash Analysis:**

```typescript
POST /hashes/guess-type
  Body: { content: string }
  Response: { candidates: HashTypeGuess[] }
```

**Events:**

```typescript
GET /events/stream?projectId=:id
  Response: WebSocket connection
  Events: agent_status, campaign_status, task_update, crack_result
```

#### Agent API (/api/v1/agent/*)

**Authentication:** Token-based (JWT)
**Traffic:** High-throughput (10K req/s bursts)
**Pattern:** Bulk operations, defined by OpenAPI spec

Defined in `openapi/agent-api.yaml`:

```typescript
POST /agent/sessions
  Body: { token, agentId }
  Response: { sessionToken, config }

POST /agent/heartbeat
  Body: { status, capabilities, deviceInfo }
  Response: { acknowledged: true }

POST /agent/tasks/next
  Body: { capabilities }
  Response: { task: Task | null }

POST /agent/tasks/:id/report
  Body: { progress, status, results: Hash[], errors }
  Response: { acknowledged: true }
  Note: Uses bulkWrite({ ordered: false }) for hash results
```

## Data Models

### MongoDB Collections

#### users

```typescript
{
  _id: ObjectId,
  email: string (unique),
  password_hash: string,
  name: string,
  status: 'active' | 'disabled',
  last_login_at: Date,
  created_at: Date,
  updated_at: Date
}
```

#### projects

```typescript
{
  _id: ObjectId,
  name: string,
  description: string,
  slug: string (unique),
  settings: {
    default_priority: number,
    max_agents: number
  },
  created_by: ObjectId (ref: users),
  created_at: Date,
  updated_at: Date
}
```

#### project_users

```typescript
{
  _id: ObjectId,
  user_id: ObjectId (ref: users),
  project_id: ObjectId (ref: projects),
  roles: string[],
  created_at: Date
}
```

#### agents

```typescript
{
  _id: ObjectId,
  name: string,
  project_id: ObjectId (ref: projects),
  operating_system_id: ObjectId (ref: operating_systems),
  auth_token: string (indexed),
  status: 'online' | 'offline' | 'busy' | 'error',
  capabilities: {
    hashcat_version: string,
    gpu_devices: [{
      name: string,
      memory: number,
      compute_capability: string
    }],
    cpu_info: {
      cores: number,
      model: string
    }
  },
  hardware_profile: object,
  last_seen_at: Date,
  current_task_id: ObjectId (ref: tasks),
  created_at: Date,
  updated_at: Date
}
```

#### campaigns

```typescript
{
  _id: ObjectId,
  project_id: ObjectId (ref: projects),
  name: string,
  description: string,
  hash_list_id: ObjectId (ref: hash_lists),
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed',
  priority: number,
  metadata: object,
  created_by: ObjectId (ref: users),
  started_at: Date,
  completed_at: Date,
  created_at: Date,
  updated_at: Date
}
```

#### attacks

```typescript
{
  _id: ObjectId,
  campaign_id: ObjectId (ref: campaigns),
  project_id: ObjectId (ref: projects),
  mode: number (hashcat mode),
  hash_type_id: ObjectId (ref: hash_types),
  wordlist_id: ObjectId (ref: word_lists),
  rulelist_id: ObjectId (ref: rule_lists),
  masklist_id: ObjectId (ref: mask_lists),
  advanced_configuration: {
    custom_charset: string[],
    increment_mode: boolean,
    optimized_kernel: boolean
  },
  keyspace: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  dependencies: ObjectId[] (ref: attacks),
  template_id: ObjectId (ref: templates),
  created_at: Date,
  updated_at: Date
}
```

#### tasks

```typescript
{
  _id: ObjectId,
  attack_id: ObjectId (ref: attacks),
  campaign_id: ObjectId (ref: campaigns),
  agent_id: ObjectId (ref: agents),
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed',
  work_range: {
    skip: number,
    limit: number
  },
  progress: {
    percent: number,
    speed: number,
    eta_seconds: number
  },
  result_stats: {
    hashes_cracked: number,
    total_hashes: number
  },
  assigned_at: Date,
  started_at: Date,
  completed_at: Date,
  failure_reason: string,
  created_at: Date,
  updated_at: Date
}
```

#### hash_lists

```typescript
{
  _id: ObjectId,
  project_id: ObjectId (ref: projects),
  name: string,
  hash_type_id: ObjectId (ref: hash_types),
  source: 'upload' | 'import' | 'api',
  file_ref: {
    bucket: string,
    key: string,
    size: number
  },
  statistics: {
    total_hashes: number,
    cracked_hashes: number,
    unique_hashes: number
  },
  status: 'uploading' | 'parsing' | 'ready' | 'error',
  created_at: Date,
  updated_at: Date
}
```

#### hash_items

```typescript
{
  _id: ObjectId,
  hash_list_id: ObjectId (ref: hash_lists),
  hash_value: string (indexed),
  plaintext: string,
  cracked_at: Date,
  metadata: {
    salt: string,
    username: string
  },
  created_at: Date
}
```

### Mongoose Schema Definitions

All models use Mongoose with TypeScript type inference:

```typescript
import { Schema, model, Document } from 'mongoose';

interface IUser extends Document {
  email: string;
  password_hash: string;
  name: string;
  status: 'active' | 'disabled';
  last_login_at: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  last_login_at: Date
}, { timestamps: true });

export const User = model<IUser>('User', userSchema);
```

### Zod Validation Schemas

**Single source of truth in `shared/` package:**

```typescript
import { z } from 'zod';

// All types inferred from Zod schemas
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CreateCampaignSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  hashListId: z.string(),
  priority: z.number().int().min(0).max(10).default(5)
});
export type CreateCampaign = z.infer<typeof CreateCampaignSchema>;

export const AgentHeartbeatSchema = z.object({
  status: z.enum(['online', 'busy', 'error']),
  capabilities: z.object({
    hashcat_version: z.string(),
    gpu_devices: z.array(z.object({
      name: z.string(),
      memory: z.number(),
      compute_capability: z.string()
    }))
  }),
  deviceInfo: z.object({
    cpu_usage: z.number(),
    memory_usage: z.number(),
    temperature: z.number().optional()
  })
});
export type AgentHeartbeat = z.infer<typeof AgentHeartbeatSchema>;

// Fastify route validation
import { FastifyRequest, FastifyReply } from 'fastify';

fastify.post('/campaigns', {
  schema: {
    body: zodToJsonSchema(CreateCampaignSchema)
  }
}, async (request: FastifyRequest, reply: FastifyReply) => {
  const data = CreateCampaignSchema.parse(request.body);
  // ...
});
```

## Error Handling

### Error Response Format

All API errors follow a consistent structure:

```typescript
{
  error: {
    code: string,        // Machine-readable error code
    message: string,     // Human-readable message
    details: object,     // Additional context
    timestamp: string,   // ISO 8601 timestamp
    requestId: string    // Trace ID for debugging
  }
}
```

### Error Categories

**Authentication Errors (401):**

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_TOKEN_INVALID`

**Authorization Errors (403):**

- `AUTHZ_INSUFFICIENT_PERMISSIONS`
- `AUTHZ_PROJECT_ACCESS_DENIED`

**Validation Errors (400):**

- `VALIDATION_FAILED`
- `VALIDATION_INVALID_HASH_TYPE`
- `VALIDATION_CIRCULAR_DEPENDENCY`

**Resource Errors (404):**

- `RESOURCE_NOT_FOUND`
- `RESOURCE_DELETED`

**Conflict Errors (409):**

- `CONFLICT_DUPLICATE_RESOURCE`
- `CONFLICT_INVALID_STATE`

**Server Errors (500):**

- `INTERNAL_SERVER_ERROR`
- `DATABASE_ERROR`
- `QUEUE_ERROR`

### Error Handling Middleware

```typescript
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const requestId = req.id || generateRequestId();

  logger.error({
    err,
    requestId,
    path: req.path,
    method: req.method
  }, 'Request error');

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        requestId
      }
    });
  }

  // Handle other error types...

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }
  });
};
```

## Testing Strategy

### Backend Testing

**Vitest for all tests (no Jest):**

- Service layer business logic
- Utility functions and helpers
- Validation schemas
- Model methods

**Integration Tests (Vitest + Testcontainers):**

- API endpoint contracts
- Database operations (MongoDB)
- Queue operations (Redis/BullMQ)
- S3 storage operations (MinIO)

**Test Structure:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('CampaignService', () => {
  let mongoContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  beforeAll(async () => {
    mongoContainer = await new GenericContainer('mongo:6')
      .withExposedPorts(27017)
      .start();
    // Connect to test database
  });

  afterAll(async () => {
    await mongoContainer.stop();
  });

  describe('createCampaign', () => {
    it('should create campaign with valid data', async () => {
      const campaign = await campaignService.createCampaign({
        projectId: testProjectId,
        name: 'Test Campaign',
        hashListId: testHashListId
      });

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Test Campaign');
    });

    it('should reject campaign with invalid hash list', async () => {
      await expect(
        campaignService.createCampaign({
          projectId: testProjectId,
          name: 'Test',
          hashListId: 'invalid'
        })
      ).rejects.toThrow('RESOURCE_NOT_FOUND');
    });
  });
});
```

### Frontend Testing

**Component Tests (Vitest + Testing Library):**

- UI component rendering
- User interactions
- Form validation
- State management (Zustand stores)

**E2E Tests (Playwright):**

- Complete user workflows
- Authentication flows
- Campaign creation
- Real-time updates

**Test Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('CampaignWizard', () => {
  it('should create campaign through wizard', async () => {
    render(<CampaignWizard projectId={testProjectId} />);

    // Step 1: Basic info
    await userEvent.type(screen.getByLabelText('Name'), 'Test Campaign');
    await userEvent.click(screen.getByText('Next'));

    // Step 2: Hash list
    await userEvent.selectOptions(
      screen.getByLabelText('Hash List'),
      'test-hash-list'
    );
    await userEvent.click(screen.getByText('Next'));

    // Step 3: Attacks
    await userEvent.click(screen.getByText('Add Attack'));
    // Configure attack...

    // Submit
    await userEvent.click(screen.getByText('Create Campaign'));

    await waitFor(() => {
      expect(screen.getByText('Campaign created successfully')).toBeInTheDocument();
    });
  });
});
```

### API Contract Testing

Using the OpenAPI specification:

```typescript
import { describe, it, expect } from 'vitest';
import { validateAgainstSchema } from 'openapi-validator';

describe('Agent API Contract', () => {
  it('should match OpenAPI spec for POST /agent/tasks/next', async () => {
    const response = await request(app)
      .post('/api/v1/agent/tasks/next')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ capabilities: testCapabilities });

    expect(response.status).toBe(200);

    const validation = validateAgainstSchema(
      'POST',
      '/agent/tasks/next',
      response.body
    );

    expect(validation.valid).toBe(true);
  });
});
```

### Test Coverage Goals

- Unit tests: 90%+ coverage
- Integration tests: All API endpoints
- E2E tests: Critical user journeys
- Contract tests: All OpenAPI endpoints

## Migration Strategy

### Phase 1: Data Export from Rails

**Export Scripts:**

```bash
# Export users and projects
rails runner scripts/export_users.rb > data/users.ndjson
rails runner scripts/export_projects.rb > data/projects.ndjson

# Export agents and capabilities
rails runner scripts/export_agents.rb > data/agents.ndjson

# Export campaigns, attacks, tasks
rails runner scripts/export_campaigns.rb > data/campaigns.ndjson
rails runner scripts/export_attacks.rb > data/attacks.ndjson
rails runner scripts/export_tasks.rb > data/tasks.ndjson

# Export resources
rails runner scripts/export_hash_lists.rb > data/hash_lists.ndjson
rails runner scripts/export_wordlists.rb > data/wordlists.ndjson
```

### Phase 2: Data Transformation

**Transform to MongoDB Documents:**

```typescript
// Transform users
async function transformUsers(railsUsers: RailsUser[]): Promise<MongoUser[]> {
  return railsUsers.map(user => ({
    email: user.email,
    password_hash: user.encrypted_password,
    name: user.name,
    status: user.active ? 'active' : 'disabled',
    last_login_at: user.last_sign_in_at,
    created_at: user.created_at,
    updated_at: user.updated_at
  }));
}

// Transform campaigns with attack references
async function transformCampaigns(
  railsCampaigns: RailsCampaign[],
  idMapping: Map<number, ObjectId>
): Promise<MongoCampaign[]> {
  return railsCampaigns.map(campaign => ({
    project_id: idMapping.get(campaign.project_id),
    name: campaign.name,
    description: campaign.description,
    hash_list_id: idMapping.get(campaign.hash_list_id),
    status: mapStatus(campaign.status),
    priority: campaign.priority,
    created_by: idMapping.get(campaign.user_id),
    created_at: campaign.created_at,
    updated_at: campaign.updated_at
  }));
}
```

### Phase 3: Import to MongoDB

**Import Scripts:**

```typescript
import { MongoClient } from 'mongodb';
import { readFile } from 'fs/promises';

async function importData() {
  const client = await MongoClient.connect(process.env.MONGO_URL);
  const db = client.db('hashhive');

  // Import users
  const users = await loadNDJSON('data/users.ndjson');
  const transformedUsers = await transformUsers(users);
  await db.collection('users').insertMany(transformedUsers);

  // Import projects
  const projects = await loadNDJSON('data/projects.ndjson');
  const transformedProjects = await transformProjects(projects);
  await db.collection('projects').insertMany(transformedProjects);

  // Continue for all collections...

  await client.close();
}
```

### Phase 4: Validation

**Validation Checks:**

```typescript
async function validateMigration() {
  const checks = [];

  // Count validation
  checks.push(await validateCounts('users', railsUserCount));
  checks.push(await validateCounts('projects', railsProjectCount));
  checks.push(await validateCounts('campaigns', railsCampaignCount));

  // Relationship validation
  checks.push(await validateReferences('campaigns', 'project_id', 'projects'));
  checks.push(await validateReferences('attacks', 'campaign_id', 'campaigns'));

  // Data integrity
  checks.push(await validateHashListIntegrity());
  checks.push(await validateAttackDAGs());

  const failed = checks.filter(c => !c.passed);
  if (failed.length > 0) {
    throw new Error(`Migration validation failed: ${failed.length} checks`);
  }
}
```

### Phase 5: Cutover

**Cutover Procedure:**

1. Schedule maintenance window
2. Set Rails to read-only mode
3. Run final data export
4. Transform and import to MongoDB
5. Run validation checks
6. Start MERN services (HashHive)
7. Verify critical workflows
8. Update agent configurations to point to HashHive
9. Monitor for issues

**Note:** Agents are self-contained and specific to each system. If HashHive encounters issues, agents can simply be reconfigured to point back to CipherSwarm without complex rollback procedures.

This design provides a comprehensive blueprint for the MERN migration, covering architecture, components, data models, error handling, testing, and migration strategy. Implementation should proceed incrementally with continuous validation against requirements.
