import { create } from 'zustand';
import { api } from '../lib/api';

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

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await api.post('/dashboard/auth/login', { email, password });
      const data = await api.get<{ user: User }>('/dashboard/auth/me');
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await api.post('/dashboard/auth/logout');
    set({ user: null, isAuthenticated: false });
  },

  clearAuth: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchUser: async () => {
    try {
      const data = await api.get<{ user: User }>('/dashboard/auth/me');
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
