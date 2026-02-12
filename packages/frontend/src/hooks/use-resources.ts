import type { HashCandidate } from '@hashhive/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUiStore } from '../stores/ui';

// API response types — represent JSON-serialized shapes (dates as strings)
interface HashList {
  id: number;
  name: string;
  projectId: number;
  hashTypeId: number | null;
  hashCount: number;
  crackedCount: number;
  createdAt: string;
}

interface HashType {
  id: number;
  name: string;
  hashcatMode: number;
  category: string;
}

interface Resource {
  id: number;
  name: string;
  projectId: number;
  fileRef: Record<string, unknown> | null;
  createdAt: string;
}

export function useHashTypes() {
  return useQuery({
    queryKey: ['hash-types'],
    queryFn: () => api.get<{ hashTypes: HashType[] }>('/dashboard/resources/hash-types'),
  });
}

export function useHashLists() {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['hash-lists', selectedProjectId],
    queryFn: () => {
      const query = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      return api.get<{ hashLists: HashList[] }>(`/dashboard/resources/hash-lists${query}`);
    },
    enabled: !!selectedProjectId,
  });
}

function useResourceList(type: 'wordlists' | 'rulelists' | 'masklists') {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: [type, selectedProjectId],
    queryFn: () => {
      const query = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      return api.get<{ resources: Resource[]; total: number }>(
        `/dashboard/resources/${type}${query}`
      );
    },
    enabled: !!selectedProjectId,
  });
}

export const useWordlists = () => useResourceList('wordlists');
export const useRulelists = () => useResourceList('rulelists');
export const useMasklists = () => useResourceList('masklists');

export function useGuessHashType() {
  return useMutation({
    mutationFn: (hashValue: string) =>
      api.post<{ hashValue: string; candidates: HashCandidate[]; identified: boolean }>(
        '/dashboard/hashes/guess-type',
        { hashValue }
      ),
  });
}

export function useCreateHashList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; projectId: number; hashTypeId?: number }) =>
      api.post<{ hashList: HashList }>(
        `/dashboard/resources/hash-lists?projectId=${data.projectId}`,
        data
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hash-lists', variables.projectId] });
    },
  });
}
