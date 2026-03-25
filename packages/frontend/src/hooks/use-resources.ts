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
    queryFn: () => api.get<{ hashLists: HashList[] }>('/dashboard/resources/hash-lists'),
    enabled: !!selectedProjectId,
  });
}

function useResourceList(type: 'wordlists' | 'rulelists' | 'masklists') {
  const { selectedProjectId } = useUiStore();

  return useQuery({
    queryKey: [type, selectedProjectId],
    queryFn: async () => {
      const data = await api.get<Record<string, Resource[]>>(`/dashboard/resources/${type}`);
      return { resources: data[type] ?? [] };
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
    mutationFn: (data: { name: string; hashTypeId?: number }) =>
      api.post<{ hashList: HashList }>('/dashboard/resources/hash-lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hash-lists'] });
    },
  });
}

type ResourceType = 'hash-lists' | 'wordlists' | 'rulelists' | 'masklists';

export function useCreateResource(type: ResourceType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string }): Promise<{ item: Resource }> => {
      const raw = await api.post<Record<string, Resource>>(`/dashboard/resources/${type}`, data);
      // Hash lists return { hashList }, generic resources return { item }
      const item = raw['item'] ?? raw['hashList'];
      if (!item) throw new Error('Unexpected response shape from create resource');
      return { item };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
    },
  });
}

export function useUploadResourceFile(type: ResourceType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      return fetch(`/api/v1/dashboard/resources/${type}/${id}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const error = body.error ?? {};
          throw new Error(error.message ?? 'Upload failed');
        }
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
    },
  });
}
