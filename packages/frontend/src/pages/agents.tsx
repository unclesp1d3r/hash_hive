import { useState } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '../components/features/status-badge';
import { useAgents } from '../hooks/use-dashboard';
import { useUiStore } from '../stores/ui';

export function AgentsPage() {
  const { selectedProjectId } = useUiStore();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useAgents(statusFilter ? { status: statusFilter } : undefined);

  if (!selectedProjectId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Agents</h2>
        <p className="text-muted-foreground">Select a project to view agents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Agents</h2>
        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="busy">Busy</option>
          <option value="error">Error</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading agents...</p>
      ) : !data?.agents.length ? (
        <p className="text-muted-foreground">No agents found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((agent) => (
                <tr key={agent.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{agent.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/agents/${agent.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
