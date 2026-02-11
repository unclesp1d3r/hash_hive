# Dashboard & Real-Time Monitoring UI

## Overview

Implement dashboard page with real-time stat cards and global layout with sidebar navigation and connection indicator.

## Scope

**In Scope:**
- Implement dashboard page with 4 stat cards (agents, campaigns, tasks, cracked hashes)
  - Note: current code computes stats client-side via multiple endpoints (`file:packages/frontend/src/hooks/use-dashboard.ts`). Decide whether to keep this initially or add a dedicated `GET /api/v1/dashboard/stats` endpoint as part of the backend execution plan.
- Add clickable navigation from stat cards to detail pages
- Implement real-time updates via WebSocket + TanStack Query cache invalidation
- Add connection indicator (subtle, always visible)
- Implement polling fallback on WebSocket disconnect (30-second intervals)
- Add global layout with sidebar navigation
- Update `file:packages/frontend/src/pages/dashboard.tsx` and `file:packages/frontend/src/components/features/layout.tsx`

**Out of Scope:**
- Advanced dashboard customization
- Dashboard widgets
- Custom date range filters

## Acceptance Criteria

1. **Dashboard Page**
   - 4 stat cards displayed in grid layout:
     - **Agents**: Total count, online count, offline count, error count
     - **Campaigns**: Total count, running count, paused count, completed count
     - **Tasks**: Total count, pending count, running count, completed count
     - **Cracked Hashes**: Total count, crack rate percentage
   - Each stat card is clickable and navigates to relevant detail page
   - Stats update in real-time via WebSocket events

2. **Real-Time Updates**
   - `useEvents()` hook establishes WebSocket connection to `/events/stream`
   - On event received, invalidates relevant TanStack Query cache keys
   - TanStack Query automatically refetches affected data
   - UI updates reactively via React re-renders
   - No manual state management for real-time data

3. **Connection Indicator**
   - Subtle indicator in top-right corner (green dot = connected, gray dot = disconnected)
   - Shows WebSocket connection status
   - Tooltip on hover shows status text ("Connected" / "Disconnected - using polling")

4. **Polling Fallback**
   - On WebSocket disconnect, frontend switches to polling mode
   - Polls `/api/v1/dashboard/stats` every 30 seconds
   - Polling stops when WebSocket reconnects
   - User sees no interruption (data continues updating)

5. **Global Layout**
   - Sidebar navigation with links to: Dashboard, Agents, Campaigns, Resources, Results
   - Project selector dropdown in sidebar (shows current project)
   - User menu in top-right (logout button)
   - Main content area with breadcrumbs
   - Layout wraps all dashboard pages

## Technical Notes

**Stat Card Component:**
```typescript
interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, onClick }: StatCardProps) {
  return (
    <div onClick={onClick} className="cursor-pointer hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon}
      </div>
    </div>
  );
}
```

**Real-Time Hook:**
```typescript
function useEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket('/events/stream');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Invalidate relevant queries based on event type
      if (data.type === 'agent_status') {
        queryClient.invalidateQueries(['agents']);
        queryClient.invalidateQueries(['dashboard-stats']);
      }
      // ... other event types
    };

    ws.onclose = () => {
      // Start polling fallback
      startPolling();
    };

    return () => ws.close();
  }, []);
}
```

**Dashboard Stats Query:**
```typescript
function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
    refetchInterval: false, // Only refetch on event or manual trigger
  });
}
```

## Dependencies

- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T3` (Real-Time Events & WebSocket Infrastructure)
- `ticket:f4542d0d-b9bd-4e50-b90b-9141e8063a18/T7` (Project Selection & User Auth API)

## Spec References

- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Flow 2: Dashboard Monitoring)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Navigation & Layout)
- `spec:f4542d0d-b9bd-4e50-b90b-9141e8063a18/98662419-66d0-40ee-a788-e5aa8c4c4de5` (Core Flows → Wireframes: Dashboard, Layout Template)
