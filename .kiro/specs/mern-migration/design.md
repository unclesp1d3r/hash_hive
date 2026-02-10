# Design Document

## Overview

HashHive is a modern TypeScript implementation that replaces the Rails-based CipherSwarm platform. The system orchestrates distributed password cracking across multiple agents using hashcat, providing campaign management, intelligent task distribution, real-time monitoring, and comprehensive resource management. The architecture uses TypeScript throughout, with **Bun** as the runtime and package manager, **Hono** framework running natively on Bun.serve(), **PostgreSQL with Drizzle ORM** for data persistence, **BullMQ/Redis** for job queuing, **MinIO** (S3-compatible storage) for binary artifacts, and **React 19 + Vite** for the operator-facing web UI.

**Key Architectural Principles:**

- **Drizzle schemas as single source of truth**: All database tables defined in `shared/db/schema.ts`, Zod schemas generated via drizzle-zod, types inferred via `z.infer<typeof schema>`
- **No premature abstraction**: Hono route handlers can call Drizzle queries directly; service layers only when needed
- **Bulk operations for Agent API**: Use Drizzle batch inserts or raw Bun.SQL for hash submissions
- **Queue-based task distribution**: BullMQ/Redis for task queuing and assignment
- **Periodic burst traffic**: Agent API handles periodic bursts when agents submit results, request work, and send heartbeats
- **Low-traffic Dashboard API**: Standard REST for 1-3 concurrent users
- **Real-time via WebSockets**: hono/websocket for dashboard updates (agent heartbeats, crack results)
- **MinIO for artifacts**: S3-compatible storage for hash lists, wordlists, rulelists, and masklists
- **Turborepo + Bun workspaces**: Monorepo with workspace packages (backend, frontend, shared, openapi)
- **Optimize for correctness and clarity**: Not premature scale; private lab environment with 7 cracking rigs

## Architecture

### High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Users (all roles)                  │
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
│         Bun Backend (Hono + TypeScript)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Layer (Hono Routes)                            │    │
│  │  - Dashboard API (/api/v1/dashboard/*)              │    │
│  │    Session-based auth, 1-3 concurrent users         │    │
│  │  - Agent API (/api/v1/agent/*)                      │    │
│  │    Token-based auth, batch operations               │    │
│  │    Bulk inserts (Drizzle batch or raw Bun.SQL)     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Service Layer (Optional - only when needed)        │    │
│  │  - AuthService, AgentService                        │    │
│  │  - CampaignService, TaskDistributionService         │    │
│  │  - ResourceService, HashAnalysisService             │    │
│  │  - EventService (WebSocket broadcasting)            │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Data Access Layer (Drizzle ORM)                    │    │
│  │  - Direct calls from routes when simple             │    │
│  │  - Indexes for hot query paths                      │    │
│  │  - Batch operations for Agent API                   │    │
│  └─────────────────────────────────────────────────────┘    │
└──┴─────────────────────────────────────────────────────┴────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ PostgreSQL  │    │ Redis/BullMQ│    │ MinIO (S3)  │
│ (Primary    │    │ (Queues &   │    │ (Binary     │
│  Data)      │    │  Pub/Sub)   │    │  Artifacts) │
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

- Bun (latest stable, currently 1.3.x) as runtime, package manager, and test runner
- Hono framework running natively on Bun.serve()
- PostgreSQL with Drizzle ORM for type-safe database access
- Drizzle table definitions in `shared/db/schema.ts` as single source of truth
- drizzle-zod for generating Zod schemas from Drizzle tables
- Zod for all data validation with types inferred via `z.infer<typeof schema>`
- hono/websocket for real-time updates
- Pino for structured logging

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

- PostgreSQL for primary data storage
- Redis for BullMQ job queues
- MinIO (S3-compatible) for binary artifacts (hash lists, wordlists, rulelists, masklists)
- Docker Compose for local development (PostgreSQL, Redis, MinIO)

**Tooling:**

- Bun for package management (exclusively, no npm, yarn, or pnpm)
- Turborepo for monorepo orchestration and caching
- bun:test for all tests (Bun's built-in test runner)
- Biome for linting, formatting, and import sorting

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

- Drizzle ORM for user queries
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

- Drizzle ORM for projects, project_users tables (roles stored as text array on project_users)
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

- Drizzle ORM for agents, agent_errors, operating_systems tables
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

- Drizzle ORM for campaigns, attacks tables
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

- Drizzle ORM for tasks, attacks tables
- BullMQ for queue operations
- AgentService for capability matching

#### 6. ResourceService

**Responsibilities:**

- Resource metadata management
- File upload to MinIO (S3-compatible storage)
- Hash list parsing and validation
- Resource access control

**Key Methods:**

- `uploadHashList(projectId, file, metadata): Promise<HashList>`
- `parseHashList(hashListId): Promise<void>`
- `uploadWordlist(projectId, file, metadata): Promise<WordList>`
- `getResourcesByProject(projectId, type): Promise<Resource[]>`

**Dependencies:**

- Drizzle ORM for hash_lists, word_lists, rule_lists, mask_lists tables
- MinIO S3 client for object storage
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

- Drizzle ORM for hash_types table
- name-that-hash library integration

#### 8. EventService

**Responsibilities:**

- Real-time event broadcasting
- WebSocket connection management
- Event filtering and routing
- Event persistence for replay (optional)

**Key Methods:**

- `broadcast(event): Promise<void>`
- `broadcastToProject(projectId, event): Promise<void>`
- `subscribe(userId, projectId, eventTypes): EventStream`
- `unsubscribe(connectionId): Promise<void>`

**Dependencies:**

- hono/websocket for WebSocket infrastructure
- Redis for pub/sub (optional for multi-instance deployments)
- PostgreSQL for event persistence (optional)

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
**Traffic:** Batch operations for periodic bursts
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
  Note: Uses Drizzle batch inserts or raw Bun.SQL for hash results
```

## Data Models

### PostgreSQL Tables

#### users

```typescript
{
  id: serial PRIMARY KEY,
  email: varchar(255) UNIQUE NOT NULL,
  password_hash: varchar(255) NOT NULL,
  name: varchar(255) NOT NULL,
  status: varchar(20) DEFAULT 'active', // 'active' | 'disabled'
  last_login_at: timestamp,
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### projects

```typescript
{
  id: serial PRIMARY KEY,
  name: varchar(255) NOT NULL,
  description: text,
  slug: varchar(255) UNIQUE NOT NULL,
  settings: jsonb DEFAULT '{}',
  created_by: integer REFERENCES users(id),
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### project_users

```typescript
{
  id: serial PRIMARY KEY,
  user_id: integer REFERENCES users(id) NOT NULL,
  project_id: integer REFERENCES projects(id) NOT NULL,
  roles: text[] NOT NULL,
  created_at: timestamp DEFAULT now(),
  UNIQUE(user_id, project_id)
}
```

#### agents

```typescript
{
  id: serial PRIMARY KEY,
  name: varchar(255) NOT NULL,
  project_id: integer REFERENCES projects(id) NOT NULL,
  operating_system_id: integer REFERENCES operating_systems(id),
  auth_token: varchar(255) UNIQUE NOT NULL,
  status: varchar(20) DEFAULT 'offline', // 'online' | 'offline' | 'busy' | 'error'
  capabilities: jsonb DEFAULT '{}',
  hardware_profile: jsonb DEFAULT '{}',
  last_seen_at: timestamp,
  current_task_id: integer REFERENCES tasks(id),
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### campaigns

```typescript
{
  id: serial PRIMARY KEY,
  project_id: integer REFERENCES projects(id) NOT NULL,
  name: varchar(255) NOT NULL,
  description: text,
  hash_list_id: integer REFERENCES hash_lists(id) NOT NULL,
  status: varchar(20) DEFAULT 'draft', // 'draft' | 'running' | 'paused' | 'completed' | 'failed'
  priority: integer DEFAULT 5,
  metadata: jsonb DEFAULT '{}',
  created_by: integer REFERENCES users(id),
  started_at: timestamp,
  completed_at: timestamp,
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### attacks

```typescript
{
  id: serial PRIMARY KEY,
  campaign_id: integer REFERENCES campaigns(id) NOT NULL,
  project_id: integer REFERENCES projects(id) NOT NULL,
  mode: integer NOT NULL, // hashcat mode
  hash_type_id: integer REFERENCES hash_types(id),
  wordlist_id: integer REFERENCES word_lists(id),
  rulelist_id: integer REFERENCES rule_lists(id),
  masklist_id: integer REFERENCES mask_lists(id),
  advanced_configuration: jsonb DEFAULT '{}',
  keyspace: varchar(255),
  status: varchar(20) DEFAULT 'pending', // 'pending' | 'running' | 'completed' | 'failed'
  dependencies: integer[], // array of attack IDs
  template_id: integer,
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### tasks

```typescript
{
  id: serial PRIMARY KEY,
  attack_id: integer REFERENCES attacks(id) NOT NULL,
  campaign_id: integer REFERENCES campaigns(id) NOT NULL,
  agent_id: integer REFERENCES agents(id),
  status: varchar(20) DEFAULT 'pending', // 'pending' | 'assigned' | 'running' | 'completed' | 'failed'
  work_range: jsonb DEFAULT '{}', // { skip: number, limit: number }
  progress: jsonb DEFAULT '{}', // { percent: number, speed: number, eta_seconds: number }
  result_stats: jsonb DEFAULT '{}', // { hashes_cracked: number, total_hashes: number }
  assigned_at: timestamp,
  started_at: timestamp,
  completed_at: timestamp,
  failure_reason: text,
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### hash_lists

```typescript
{
  id: serial PRIMARY KEY,
  project_id: integer REFERENCES projects(id) NOT NULL,
  name: varchar(255) NOT NULL,
  hash_type_id: integer REFERENCES hash_types(id),
  source: varchar(50) DEFAULT 'upload', // 'upload' | 'import' | 'api'
  file_ref: jsonb DEFAULT '{}', // { bucket: string, key: string, size: number }
  statistics: jsonb DEFAULT '{}', // { total_hashes: number, cracked_hashes: number, unique_hashes: number }
  status: varchar(20) DEFAULT 'uploading', // 'uploading' | 'parsing' | 'ready' | 'error'
  created_at: timestamp DEFAULT now(),
  updated_at: timestamp DEFAULT now()
}
```

#### hash_items

```typescript
{
  id: serial PRIMARY KEY,
  hash_list_id: integer REFERENCES hash_lists(id) NOT NULL,
  hash_value: varchar(255) NOT NULL,
  plaintext: text,
  cracked_at: timestamp,
  metadata: jsonb DEFAULT '{}', // { salt: string, username: string }
  created_at: timestamp DEFAULT now()
}
CREATE INDEX idx_hash_items_hash_value ON hash_items(hash_value);
CREATE INDEX idx_hash_items_hash_list_id ON hash_items(hash_list_id);
```

### Drizzle Schema Definitions

All tables are defined using Drizzle ORM in `shared/db/schema.ts` as the single source of truth:

```typescript
import { pgTable, serial, varchar, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).default('active'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Projects table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  settings: jsonb('settings').default('{}'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Agents table
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  operatingSystemId: integer('operating_system_id').references(() => operatingSystems.id),
  authToken: varchar('auth_token', { length: 255 }).notNull().unique(),
  status: varchar('status', { length: 20 }).default('offline'),
  capabilities: jsonb('capabilities').default('{}'),
  hardwareProfile: jsonb('hardware_profile').default('{}'),
  lastSeenAt: timestamp('last_seen_at'),
  currentTaskId: integer('current_task_id').references(() => tasks.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Campaigns table
export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  hashListId: integer('hash_list_id').references(() => hashLists.id).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  priority: integer('priority').default(5),
  metadata: jsonb('metadata').default('{}'),
  createdBy: integer('created_by').references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projectUsers),
  createdProjects: many(projects),
  createdCampaigns: many(campaigns)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id]
  }),
  members: many(projectUsers),
  agents: many(agents),
  campaigns: many(campaigns)
}));
```

### Zod Validation Schemas

**Single source of truth using drizzle-zod:**

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, projects, campaigns, agents } from './db/schema';

// Generate base schemas from Drizzle tables
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

export const insertCampaignSchema = createInsertSchema(campaigns);
export const selectCampaignSchema = createSelectSchema(campaigns);

// Infer TypeScript types from Zod schemas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type SelectProject = z.infer<typeof selectProjectSchema>;

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type SelectCampaign = z.infer<typeof selectCampaignSchema>;

// Custom validation schemas for API requests
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const createCampaignSchema = insertCampaignSchema.pick({
  projectId: true,
  name: true,
  description: true,
  hashListId: true,
  priority: true
});
export type CreateCampaign = z.infer<typeof createCampaignSchema>;

export const agentHeartbeatSchema = z.object({
  status: z.enum(['online', 'busy', 'error']),
  capabilities: z.object({
    hashcatVersion: z.string(),
    gpuDevices: z.array(z.object({
      name: z.string(),
      memory: z.number(),
      computeCapability: z.string()
    }))
  }),
  deviceInfo: z.object({
    cpuUsage: z.number(),
    memoryUsage: z.number(),
    temperature: z.number().optional()
  })
});
export type AgentHeartbeat = z.infer<typeof agentHeartbeatSchema>;

// Hono route validation
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

app.post('/campaigns', zValidator('json', createCampaignSchema), async (c) => {
  const data = c.req.valid('json');
  // data is fully typed as CreateCampaign
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

**bun:test for all tests:**

- Service layer business logic
- Utility functions and helpers
- Validation schemas
- Drizzle queries and relations

**Integration Tests (bun:test + Testcontainers):**

- API endpoint contracts
- Database operations (PostgreSQL)
- Queue operations (Redis/BullMQ)
- S3 storage operations (MinIO)

**Test Structure:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('CampaignService', () => {
  let postgresContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let minioContainer: StartedTestContainer;

  beforeAll(async () => {
    postgresContainer = await new GenericContainer('postgres:16')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'hashhive_test'
      })
      .start();

    redisContainer = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();

    minioContainer = await new GenericContainer('minio/minio')
      .withExposedPorts(9000)
      .withCommand(['server', '/data'])
      .start();

    // Connect to test database and run migrations
  });

  afterAll(async () => {
    await postgresContainer.stop();
    await redisContainer.stop();
    await minioContainer.stop();
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
          hashListId: 999999
        })
      ).rejects.toThrow('RESOURCE_NOT_FOUND');
    });
  });
});
```

### Frontend Testing

**Component Tests (bun:test + Testing Library):**

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
import { describe, it, expect } from 'bun:test';
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
import { describe, it, expect } from 'bun:test';
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

**Transform to PostgreSQL Rows:**

```typescript
// Transform users
async function transformUsers(railsUsers: RailsUser[]): Promise<PostgresUser[]> {
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
  idMapping: Map<number, number>
): Promise<PostgresCampaign[]> {
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

### Phase 3: Import to PostgreSQL

**Import Scripts:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFile } from 'fs/promises';
import { users, projects, campaigns } from './shared/db/schema';

async function importData() {
  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  // Import users
  const railsUsers = await loadNDJSON('data/users.ndjson');
  const transformedUsers = await transformUsers(railsUsers);
  await db.insert(users).values(transformedUsers);

  // Import projects
  const railsProjects = await loadNDJSON('data/projects.ndjson');
  const transformedProjects = await transformProjects(railsProjects);
  await db.insert(projects).values(transformedProjects);

  // Continue for all tables...

  await client.end();
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
4. Transform and import to PostgreSQL
5. Run validation checks
6. Start HashHive services (Bun backend + React frontend)
7. Verify critical workflows
8. Update agent configurations to point to HashHive
9. Monitor for issues

**Note:** Agents are self-contained and specific to each system. If HashHive encounters issues, agents can simply be reconfigured to point back to CipherSwarm without complex rollback procedures.

This design provides a comprehensive blueprint for the HashHive migration, covering architecture, components, data models, error handling, testing, and migration strategy. Implementation should proceed incrementally with continuous validation against requirements.
