import { create } from 'zustand';
import { api } from '../lib/api';
import { useUiStore } from './ui';

interface User {
  id: number;
  email: string;
  name: string;
  projects: Array<{
    projectId: number;
    projectName: string;
    roles: string[];
  }>;
}

interface LoginResponse {
  user: { id: number; email: string; name: string; status: string };
  selectedProjectId?: number;
}

interface MeResponse {
  user: User;
  projects: Array<{ id: number; name: string; slug: string; roles: string[] }>;
  selectedProjectId?: number;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ selectedProjectId?: number }>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  selectProject: (projectId: number) => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const loginResult = await api.post<LoginResponse>('/dashboard/auth/login', {
        email,
        password,
      });
      const data = await api.get<MeResponse>('/dashboard/auth/me');
      const user: User = {
        ...data.user,
        projects: data.projects.map((p) => ({
          projectId: p.id,
          projectName: p.name,
          roles: p.roles,
        })),
      };
      set({ user, isAuthenticated: true, isLoading: false });
      return {
        ...(loginResult.selectedProjectId
          ? { selectedProjectId: loginResult.selectedProjectId }
          : {}),
      };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await api.post('/dashboard/auth/logout');
    useUiStore.getState().setSelectedProject(null);
    set({ user: null, isAuthenticated: false });
  },

  clearAuth: () => {
    useUiStore.getState().setSelectedProject(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  selectProject: async (projectId: number) => {
    await api.post('/dashboard/projects/select', { projectId });
  },

  fetchUser: async () => {
    try {
      const data = await api.get<MeResponse>('/dashboard/auth/me');
      const user: User = {
        ...data.user,
        projects: data.projects.map((p) => ({
          projectId: p.id,
          projectName: p.name,
          roles: p.roles,
        })),
      };
      set({ user, isAuthenticated: true, isLoading: false });

      // Restore project selection from JWT if available
      if (data.selectedProjectId) {
        useUiStore.getState().setSelectedProject(data.selectedProjectId);
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
