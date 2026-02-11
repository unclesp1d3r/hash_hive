# Campaign List & Detail UI

## Overview

Implement campaign list page with filters and quick actions, plus campaign detail page with progress tracking, DAG visualization, and control buttons.

## Scope

**In Scope:**
- Implement campaign list page with filters (status, priority) and sorting
- Add quick actions (start/pause/stop) with confirmation modal for start from list
- Implement campaign detail page with progress bar and ETA
- Add DAG visualization (read-only graph display)
- Add active agents and task distribution section
- Add campaign control buttons (one-click start from detail page)
- Implement real-time progress updates
- Update `file:packages/frontend/src/pages/campaigns.tsx` and create `file:packages/frontend/src/pages/campaign-detail.tsx`

**Out of Scope:**
- Campaign editing (create new instead)
- Campaign cloning
- Campaign templates

## Acceptance Criteria

1. **Campaign List Page**
   - Table view of all campaigns in current project
   - Columns: Name, Status, Priority, Progress, Hash List, Created At, Actions
   - Status badge (draft = gray, running = blue, paused = yellow, completed = green, stopped = red)
   - Priority badge (high = red, normal = blue, low = gray)
   - Progress bar in progress column
   - Filter dropdowns: Status (all/draft/running/paused/completed), Priority (all/high/normal/low)
   - Sort by: Name, Created At, Priority
   - Quick actions dropdown: Start, Pause, Stop, View Details, Delete

2. **Campaign Start Confirmation (List)**
   - Clicking "Start" from list quick actions shows confirmation modal
   - Modal displays campaign summary: Name, Hash List, Attack count, Priority
   - "Confirm Start" button calls API
   - Modal closes on success
   - Campaign status updates to "running"

3. **Campaign Detail Page**
   - Header with campaign name, status badge, priority badge
   - **Progress Section**:
     - Large progress bar (0-100%)
     - ETA display (e.g., "Estimated completion: 2 hours 15 minutes")
     - Task statistics: Total, Pending, Running, Completed, Failed
   - **DAG Visualization Section**:
     - Read-only graph showing attack dependencies
     - Nodes represent attacks (labeled with attack mode)
     - Edges represent dependencies
     - Node colors indicate attack status (pending/running/completed/failed)
   - **Active Agents Section**:
     - Table of agents working on campaign tasks
     - Columns: Agent Name, Current Attack, Progress, Speed
   - **Control Buttons**:
     - Start (one-click, no confirmation from detail page)
     - Pause
     - Stop (confirmation modal)
     - Delete (confirmation modal, only in draft status)

4. **Real-Time Updates**
   - Progress bar updates in real-time via WebSocket
   - ETA recalculates as tasks complete
   - DAG node colors update as attacks progress
   - Active agents table updates when agents start/complete tasks

5. **Campaign Stop Confirmation**
   - Clicking "Stop" shows confirmation modal
   - Modal warns: "This will cancel all running tasks and return the campaign to draft status"
   - "Confirm Stop" button calls API
   - Campaign status updates to "stopped"

## Technical Notes

**Campaign List Query:**
```typescript
function useCampaigns(filters?: { status?: string; priority?: string }) {
  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => api.get('/dashboard/campaigns', { params: filters }),
  });
}
```

**Campaign Detail Query:**
```typescript
function useCampaign(campaignId: number) {
  return useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: () => api.get(`/dashboard/campaigns/${campaignId}`),
  });
}
```

**DAG Visualization:**
- Use a graph library (e.g., react-flow, cytoscape.js)
- Nodes positioned using hierarchical layout
- Edges drawn with arrows indicating dependency direction
- Node click shows attack details in tooltip

**Progress Bar Component:**
```typescript
function ProgressBar({ percentage, eta }: { percentage: number; eta?: string }) {
  return (
    <div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-gray-500 mt-1">
        {percentage.toFixed(1)}% complete
        {eta && ` • ETA: ${eta}`}
      </p>
    </div>
  );
}
```

**Campaign Control Actions:**
```typescript
function useCampaignAction(campaignId: number, action: 'start' | 'pause' | 'stop') {
  return useMutation({
    mutationFn: () => api.post(`/dashboard/campaigns/${campaignId}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['campaigns', campaignId]);
    },
  });
}
```

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T9` (Campaign Orchestration API)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T3` (Real-Time Events)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flow 4: Campaign Management)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Wireframes: Campaign List, Campaign Detail)
