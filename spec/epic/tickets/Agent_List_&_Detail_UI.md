# Agent List & Detail UI

## Overview

Implement agent list page with status filters and error badges, plus agent detail page with hardware profile and error logs.

## Scope

**In Scope:**
- Implement agent list page with status filters (all, online, offline, error)
- Add error badges on agent cards
- Implement agent detail page with hardware profile display
- Add current tasks section on agent detail
- Add error log table with severity, message, timestamp
- Implement real-time agent status updates
- Update `file:packages/frontend/src/pages/agents.tsx` and create `file:packages/frontend/src/pages/agent-detail.tsx`

**Out of Scope:**
- Agent configuration UI
- Agent performance charts
- Agent registration UI

## Acceptance Criteria

1. **Agent List Page**
   - Table/grid view of all agents in current project
   - Columns: Name, Status, Last Seen, Current Task, Hardware (GPU count), Actions
   - Status badge (green = online, gray = offline, red = error)
   - Error badge shows error count if agent has recent errors
   - Filter buttons: All, Online, Offline, Error
   - Clicking agent row navigates to agent detail page

2. **Agent Detail Page**
   - Header with agent name, status badge, last seen timestamp
   - **Hardware Profile Section**:
     - OS (name, version, platform)
     - CPU (model, cores)
     - RAM (total, available)
     - GPUs (model, count, driver version)
     - Hashcat version
   - **Current Tasks Section**:
     - Table of tasks assigned to agent
     - Columns: Campaign, Attack, Status, Progress, Speed
     - Empty state if no tasks assigned
   - **Error Log Section**:
     - Table of recent errors (last 50)
     - Columns: Severity, Message, Timestamp, Task (if applicable)
     - Severity badge (yellow = warning, red = fatal)
     - Expandable row for full error context

3. **Real-Time Updates**
   - Agent status updates in real-time via WebSocket
   - Last seen timestamp updates automatically
   - Current tasks update when agent starts/completes tasks
   - Error log updates when new errors reported

4. **Error Badges**
   - Show error count badge on agent card if errors in last 24 hours
   - Badge color indicates severity (yellow = warnings only, red = fatal errors)
   - Clicking badge navigates to agent detail error log section

## Technical Notes

**Agent List Query:**
```typescript
function useAgents(statusFilter?: 'online' | 'offline' | 'error') {
  return useQuery({
    queryKey: ['agents', statusFilter],
    queryFn: () => api.get('/dashboard/agents', { params: { status: statusFilter } }),
  });
}
```

**Agent Detail Query:**
```typescript
function useAgent(agentId: number) {
  return useQuery({
    queryKey: ['agents', agentId],
    queryFn: () => api.get(`/dashboard/agents/${agentId}`),
  });
}

function useAgentErrors(agentId: number) {
  return useQuery({
    queryKey: ['agents', agentId, 'errors'],
    queryFn: () => api.get(`/dashboard/agents/${agentId}/errors`),
  });
}
```

**Status Badge Component:**
```typescript
function StatusBadge({ status }: { status: 'online' | 'offline' | 'error' }) {
  const colors = {
    online: 'bg-green-100 text-green-800',
    offline: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${colors[status]}`}>
      {status}
    </span>
  );
}
```

**Hardware Profile Display:**
- Display as key-value pairs or cards
- GPU section shows each GPU with model and memory
- Capabilities section shows supported hashcat modes

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T6` (Agent Heartbeat & Error Handling)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T3` (Real-Time Events)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flow 5: Agent Monitoring)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Wireframes: Agent List, Agent Detail)
