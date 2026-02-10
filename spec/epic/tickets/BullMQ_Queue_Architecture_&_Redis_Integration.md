# BullMQ Queue Architecture & Redis Integration

## Overview

Refactor the task queue architecture to use explicit priority queues and dedicated job queues, implementing the Redis degradation policy to ensure agent endpoints remain available even when Redis is down.

## Scope

**In Scope:**
- Refactor queue structure from current `task-assignment` and `hash-import` to explicit priority queues (`tasks:high`, `tasks:normal`, `tasks:low`)
- Add dedicated job queues (`jobs:hash-list-parsing`, `jobs:task-generation`, `jobs:heartbeat-monitor`)
- Implement Redis degradation policy: agent-facing endpoints remain available when Redis is down; async-dependent dashboard operations are blocked
- Create BullMQ worker processes for background jobs
- Add health checks for Redis connectivity
- Update queue configuration in `file:packages/backend/src/config/queue.ts`

**Out of Scope:**
- Redis pub/sub for multi-instance (documented as extension path, not implemented in v1)
- Task queue monitoring UI
- Advanced queue metrics/observability

## Acceptance Criteria

1. **Priority Queue Structure**
   - Three priority queues exist: `tasks:high`, `tasks:normal`, `tasks:low`
   - Campaign priority determines which queue tasks are enqueued to
   - Higher priority queues are processed before lower priority queues

2. **Job Queues**
   - `jobs:hash-list-parsing` queue handles async hash list parsing
   - `jobs:task-generation` queue handles async task generation for large campaigns
   - `jobs:heartbeat-monitor` queue handles periodic agent heartbeat checks

3. **Redis Degradation Policy**
   - When Redis is unavailable:
     - Agent endpoints (`/api/v1/agent/*`) continue to function (heartbeat, task requests, result submissions)
     - Dashboard operations requiring async processing (hash list upload, large campaign start) return appropriate error messages
     - Health check endpoint reports Redis status
   - When Redis recovers, queued operations resume automatically

4. **Worker Processes**
   - Separate worker processes consume each job queue
   - Workers handle job failures with retry logic (exponential backoff)
   - Workers log job processing metrics (duration, success/failure)

5. **Health Checks**
   - Redis connectivity check added to `/health` endpoint
   - Health check reports queue status (connected/disconnected)
   - Health check includes queue depth metrics

## Technical Notes

**Current Implementation:**
- `file:packages/backend/src/config/queue.ts` defines `task-assignment` and `hash-import` queues
- Need to refactor to new queue structure while maintaining backward compatibility during migration

**Queue Configuration:**
```typescript
// Priority queues for task distribution
const taskQueues = {
  high: new Queue('tasks:high', { connection: redisConnection }),
  normal: new Queue('tasks:normal', { connection: redisConnection }),
  low: new Queue('tasks:low', { connection: redisConnection }),
};

// Job queues for background processing
const jobQueues = {
  hashListParsing: new Queue('jobs:hash-list-parsing', { connection: redisConnection }),
  taskGeneration: new Queue('jobs:task-generation', { connection: redisConnection }),
  heartbeatMonitor: new Queue('jobs:heartbeat-monitor', { connection: redisConnection }),
};
```

**Degradation Strategy:**
- Wrap BullMQ operations in try-catch blocks
- Return graceful errors when Redis is unavailable
- Agent endpoints bypass Redis entirely (direct PostgreSQL queries)

## Dependencies

None (foundation layer)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Asynchronous Processing Strategy)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Redis Degradation Policy)
