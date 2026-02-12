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

export function useWordlists() {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['wordlists', selectedProjectId],
    queryFn: () => {
      const query = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      return api.get<{ resources: Resource[]; total: number }>(
        `/dashboard/resources/wordlists${query}`
      );
    },
    enabled: !!selectedProjectId,
  });
}

export function useRulelists() {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['rulelists', selectedProjectId],
    queryFn: () => {
      const query = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      return api.get<{ resources: Resource[]; total: number }>(
        `/dashboard/resources/rulelists${query}`
      );
    },
    enabled: !!selectedProjectId,
  });
}

export function useMasklists() {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: ['masklists', selectedProjectId],
    queryFn: () => {
      const query = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      return api.get<{ resources: Resource[]; total: number }>(
        `/dashboard/resources/masklists${query}`
      );
    },
    enabled: !!selectedProjectId,
  });
}

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
  const { selectedProjectId } = useUiStore();

  return useMutation({
    mutationFn: (data: { name: string; projectId: number; hashTypeId?: number }) =>
      api.post<{ hashList: HashList }>(
        `/dashboard/resources/hash-lists?projectId=${data.projectId}`,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hash-lists', selectedProjectId] });
    },
  });
}
