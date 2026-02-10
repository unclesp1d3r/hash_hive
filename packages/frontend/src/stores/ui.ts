import { create } from 'zustand';

interface UiState {
  selectedProjectId: number | null;
  sidebarOpen: boolean;
  setSelectedProject: (projectId: number | null) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedProjectId: null,
  sidebarOpen: true,
  setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
