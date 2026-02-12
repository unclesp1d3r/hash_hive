import type { CreateAttackRequest, CreateCampaignRequest } from '@hashhive/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUiStore } from '../stores/ui';

// API response types — represent JSON-serialized shapes (dates as strings)
interface Campaign {
  id: number;
  name: string;
  status: string;
  projectId: number;
}

interface Attack {
  id: number;
  campaignId: number;
  mode: number;
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) =>
      api.post<{ campaign: Campaign }>(`/dashboard/campaigns?projectId=${data.projectId}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.projectId] });
    },
  });
}

export function useCreateAttack(campaignId: number) {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useUiStore();

  return useMutation({
    mutationFn: (data: CreateAttackRequest) =>
      api.post<{ attack: Attack }>(
        `/dashboard/campaigns/${campaignId}/attacks?projectId=${selectedProjectId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}

export function useCampaignLifecycle(campaignId: number) {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useUiStore();

  return useMutation({
    mutationFn: (action: 'start' | 'pause' | 'stop' | 'cancel') =>
      api.post<{ campaign: Campaign }>(
        `/dashboard/campaigns/${campaignId}/lifecycle?projectId=${selectedProjectId}`,
        { action }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}
