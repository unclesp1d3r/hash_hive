import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUiStore } from '../stores/ui';

interface DashboardStats {
  agents: { total: number; online: number };
  campaigns: { total: number; active: number };
  tasks: { total: number; running: number };
  cracked: { total: number };
}

interface Agent {
  id: number;
  name: string;
  status: string;
  lastSeenAt: string | null;
  projectId: number;
  capabilities: Record<string, unknown> | null;
  hardwareProfile: Record<string, unknown> | null;
  createdAt: string;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  projectId: number;
  priority: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Task {
  id: number;
  status: string;
  campaignId: number;
  attackId: number;
  agentId: number | null;
  createdAt: string;
}

interface AgentError {
  id: number;
  agentId: number;
  severity: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function useDashboardStats() {
  const { selectedProjectId } = useUiStore();

  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', selectedProjectId],
    queryFn: async () => {
      const projectFilter = selectedProjectId ? `?projectId=${selectedProjectId}` : '';

      const [agentsRes, campaignsRes, tasksRes] = await Promise.all([
        api.get<{ agents: Agent[]; total: number }>(`/dashboard/agents${projectFilter}`),
        api.get<{ campaigns: Campaign[]; total: number }>(`/dashboard/campaigns${projectFilter}`),
        api.get<{ tasks: Task[]; total: number }>(`/dashboard/tasks${projectFilter}&limit=0`),
      ]);

      const onlineAgents = agentsRes.agents.filter((a) => a.status === 'online').length;
      const activeCampaigns = campaignsRes.campaigns.filter((c) => c.status === 'running').length;
      const runningTasks = tasksRes.tasks.filter((t) => t.status === 'running').length;

      return {
        agents: { total: agentsRes.total, online: onlineAgents },
        campaigns: { total: campaignsRes.total, active: activeCampaigns },
        tasks: { total: tasksRes.total, running: runningTasks },
        cracked: { total: 0 }, // Will be wired when hash items have a cracked count endpoint
      };
    },
    enabled: !!selectedProjectId,
    refetchInterval: 30_000,
  });
}

export function useAgents(options?: { status?: string; limit?: number; offset?: number }) {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['agents', selectedProjectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set('projectId', String(selectedProjectId));
      if (options?.status) params.set('status', options.status);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const query = params.toString();
      return api.get<{ agents: Agent[]; total: number }>(
        `/dashboard/agents${query ? `?${query}` : ''}`
      );
    },
    enabled: !!selectedProjectId,
  });
}

export function useAgent(agentId: number) {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['agent', agentId, selectedProjectId],
    queryFn: () =>
      api.get<{ agent: Agent }>(`/dashboard/agents/${agentId}?projectId=${selectedProjectId}`),
    enabled: agentId > 0 && !!selectedProjectId,
  });
}

export function useAgentErrors(agentId: number) {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['agent-errors', agentId, selectedProjectId],
    queryFn: () =>
      api.get<{ errors: AgentError[] }>(
        `/dashboard/agents/${agentId}/errors?projectId=${selectedProjectId}&limit=50`
      ),
    enabled: agentId > 0 && !!selectedProjectId,
  });
}

export function useCampaigns(options?: { status?: string; limit?: number; offset?: number }) {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['campaigns', selectedProjectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedProjectId) params.set('projectId', String(selectedProjectId));
      if (options?.status) params.set('status', options.status);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const query = params.toString();
      return api.get<{ campaigns: Campaign[]; total: number }>(
        `/dashboard/campaigns${query ? `?${query}` : ''}`
      );
    },
    enabled: !!selectedProjectId,
  });
}
