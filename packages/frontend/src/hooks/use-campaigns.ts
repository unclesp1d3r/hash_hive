import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CreateCampaignData {
  projectId: number;
  name: string;
  description?: string;
  hashListId: number;
  priority?: number;
}

interface CreateAttackData {
  mode: number;
  hashTypeId?: number;
  wordlistId?: number;
  rulelistId?: number;
  masklistId?: number;
  dependencies?: number[];
}

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
    mutationFn: (data: CreateCampaignData) =>
      api.post<{ campaign: Campaign }>('/dashboard/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useCreateAttack(campaignId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAttackData) =>
      api.post<{ attack: Attack }>(`/dashboard/campaigns/${campaignId}/attacks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}

export function useCampaignLifecycle(campaignId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: 'start' | 'pause' | 'stop' | 'cancel') =>
      api.post<{ campaign: Campaign }>(`/dashboard/campaigns/${campaignId}/lifecycle`, {
        action,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });
}
