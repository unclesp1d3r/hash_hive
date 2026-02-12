import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { StatusBadge } from '../components/features/status-badge';
import { useCampaignLifecycle } from '../hooks/use-campaigns';
import { api } from '../lib/api';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  status: string;
  projectId: number;
  hashListId: number;
  priority: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Attack {
  id: number;
  campaignId: number;
  mode: number;
  status: string;
  wordlistId: number | null;
  rulelistId: number | null;
  masklistId: number | null;
  dependencies: number[] | null;
}

function useCampaignDetail(campaignId: number) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () =>
      api.get<{ campaign: Campaign; attacks: Attack[] }>(`/dashboard/campaigns/${campaignId}`),
    enabled: campaignId > 0,
  });
}

const LIFECYCLE_ACTIONS: Record<
  string,
  Array<{ action: 'start' | 'pause' | 'stop' | 'cancel'; label: string }>
> = {
  pending: [{ action: 'start', label: 'Start' }],
  running: [
    { action: 'pause', label: 'Pause' },
    { action: 'stop', label: 'Stop' },
    { action: 'cancel', label: 'Cancel' },
  ],
  paused: [
    { action: 'start', label: 'Resume' },
    { action: 'cancel', label: 'Cancel' },
  ],
};

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const campaignId = Number(id);
  const { data, isLoading } = useCampaignDetail(campaignId);
  const lifecycle = useCampaignLifecycle(campaignId);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading campaign...</p>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link to="/campaigns" className="text-sm text-primary hover:underline">
          Back to campaigns
        </Link>
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    );
  }

  const { campaign, attacks } = data;
  const actions = LIFECYCLE_ACTIONS[campaign.status] ?? [];

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="text-sm text-primary hover:underline">
        Back to campaigns
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{campaign.name}</h2>
          <StatusBadge status={campaign.status} />
        </div>
        <div className="flex gap-2">
          {actions.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              onClick={() => lifecycle.mutate(action)}
              disabled={lifecycle.isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {campaign.description && <p className="text-muted-foreground">{campaign.description}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Priority</p>
          <p className="mt-1 text-2xl font-bold">{campaign.priority}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Attacks</p>
          <p className="mt-1 text-2xl font-bold">{attacks.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Hash List</p>
          <p className="mt-1 text-2xl font-bold">#{campaign.hashListId}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Attacks</h3>
        {attacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attacks configured.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Wordlist</th>
                  <th className="px-4 py-3 font-medium">Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {attacks.map((attack) => (
                  <tr key={attack.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{attack.id}</td>
                    <td className="px-4 py-3 font-medium">{attack.mode}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={attack.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {attack.wordlistId ? `#${attack.wordlistId}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {attack.dependencies?.length ? attack.dependencies.join(', ') : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Created: {new Date(campaign.createdAt).toLocaleString()}</p>
        {campaign.startedAt && <p>Started: {new Date(campaign.startedAt).toLocaleString()}</p>}
        {campaign.completedAt && (
          <p>Completed: {new Date(campaign.completedAt).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}
