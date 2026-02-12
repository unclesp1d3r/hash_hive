# Agent Heartbeat & Error Handling

## Overview

Implement agent heartbeat processing with status transitions, error classification (warning vs fatal), and error logging to support agent monitoring and task failure handling.

## Scope

**In Scope:**
- Implement heartbeat endpoint with `last_seen_at` update
- Add agent status transitions (online/offline/error)
- Implement error classification (warning vs fatal)
- Add error logging to `agent_errors` table
- Implement fatal error → task failure logic
- Update `file:packages/backend/src/routes/agent/index.ts` and `file:packages/backend/src/services/agents.ts`

**Out of Scope:**
- Agent error analytics/dashboards (handled in frontend ticket)
- Automated remediation
- Agent performance metrics

## Acceptance Criteria

1. **Heartbeat Endpoint**
   - `POST /api/v1/agent/heartbeat` accepts agent status payload
   - Updates `agents.last_seen_at` to current timestamp
   - Updates `agents.status` based on heartbeat data
   - Returns `has_high_priority_tasks` flag if urgent work available
   - Heartbeat is idempotent (safe to call repeatedly)

2. **Agent Status Transitions**
   - `online`: Agent actively sending heartbeats (last_seen_at < 5 minutes ago)
   - `offline`: Agent stopped sending heartbeats (last_seen_at > 5 minutes ago)
   - `error`: Agent reported fatal error in heartbeat
   - Status transitions logged for audit trail

3. **Error Classification**
   - **Warning**: Logged to `agent_errors`, task continues (e.g., temperature spike, driver reset)
   - **Fatal**: Logged to `agent_errors`, task fails (e.g., hashcat crash, invalid configuration)
   - Severity stored in `agent_errors.severity` (warning/fatal)

4. **Error Logging**
   - Errors logged to `agent_errors` table with:
     - `agent_id`, `severity`, `message`, `context` (JSONB), `task_id` (if applicable)
   - Context includes stack trace, hashcat output, system metrics
   - Errors linked to tasks when applicable

5. **Fatal Error Handling**
   - When agent reports fatal error:
     - Task status set to `failed`
     - Task `failure_reason` set to error message
     - Task retry logic applies (up to 3 retries)
     - Agent status set to `error`

## Technical Notes

**Heartbeat Payload:**
```typescript
interface HeartbeatPayload {
  status: 'online' | 'error';
  currentTask?: {
    taskId: number;
    progress: number;
    speed: number;
    temperature?: number;
  };
  error?: {
    severity: 'warning' | 'fatal';
    message: string;
    context: Record<string, unknown>;
  };
}
```

**Status Transition Logic:**
```typescript
// Heartbeat updates status
if (payload.status === 'error' && payload.error?.severity === 'fatal') {
  await updateAgentStatus(agentId, 'error');
  await failCurrentTask(agentId, payload.error.message);
} else {
  await updateAgentStatus(agentId, 'online');
}

await updateLastSeenAt(agentId);
```

**Background Job (Offline Detection):**
- Runs every 2 minutes
- Queries agents with `last_seen_at < now() - 5 minutes` and `status = online`
- Updates status to `offline`
- Triggers task reassignment (handled in Task Distribution ticket)

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T4` (Agent Authentication)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/9332598a-b507-42ee-8e71-6a8e43712c16` (Tech Plan → Error Handling & Recovery)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flow 5: Agent Monitoring)
