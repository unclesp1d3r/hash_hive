import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ConnectionIndicator } from '../components/features/connection-indicator';
import { StatCard } from '../components/features/stat-card';
import { useDashboardStats } from '../hooks/use-dashboard';
import { type AppEvent, useEvents } from '../hooks/use-events';
import { useUiStore } from '../stores/ui';

export function DashboardPage() {
  const { selectedProjectId } = useUiStore();
  const { data: stats, isLoading } = useDashboardStats();
  const queryClient = useQueryClient();

  const handleEvent = useCallback(
    (event: AppEvent) => {
      // Invalidate relevant queries on real-time events
      if (event.type === 'agent_status') {
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      } else if (event.type === 'campaign_status') {
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      } else if (event.type === 'task_update' || event.type === 'crack_result') {
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      }
    },
    [queryClient]
  );

  const { connected } = useEvents({ onEvent: handleEvent });

  if (!selectedProjectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Select a project to view its dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <ConnectionIndicator connected={connected} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Agents"
          value={stats ? `${stats.agents.online} / ${stats.agents.total}` : '--'}
          subtitle="Online"
          loading={isLoading}
        />
        <StatCard
          title="Campaigns"
          value={stats?.campaigns.active ?? '--'}
          subtitle="Active"
          loading={isLoading}
        />
        <StatCard
          title="Tasks"
          value={stats?.tasks.running ?? '--'}
          subtitle="Running"
          loading={isLoading}
        />
        <StatCard
          title="Cracked"
          value={stats?.cracked.total ?? '--'}
          subtitle="Total hashes"
          loading={isLoading}
        />
      </div>
    </div>
  );
}
