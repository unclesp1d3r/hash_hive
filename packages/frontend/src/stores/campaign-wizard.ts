import { create } from 'zustand';

interface AttackConfig {
  mode: number;
  hashTypeId?: number;
  wordlistId?: number;
  rulelistId?: number;
  masklistId?: number;
  dependencies: number[];
}

interface WizardState {
  step: number;
  // Step 1: Basic info
  name: string;
  description: string;
  priority: number;
  hashListId: number | null;
  // Step 2: Attacks
  attacks: AttackConfig[];
  // Actions
  setStep: (step: number) => void;
  setBasicInfo: (info: { name: string; description: string; priority: number }) => void;
  setHashListId: (id: number | null) => void;
  addAttack: (attack: AttackConfig) => void;
  removeAttack: (index: number) => void;
  updateAttack: (index: number, attack: AttackConfig) => void;
  reset: () => void;
}

const initialState = {
  step: 0,
  name: '',
  description: '',
  priority: 5,
  hashListId: null as number | null,
  attacks: [] as AttackConfig[],
};

export const useCampaignWizard = create<WizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setBasicInfo: (info) => set(info),
  setHashListId: (hashListId) => set({ hashListId }),
  addAttack: (attack) => set((s) => ({ attacks: [...s.attacks, attack] })),
  removeAttack: (index) => set((s) => ({ attacks: s.attacks.filter((_, i) => i !== index) })),
  updateAttack: (index, attack) =>
    set((s) => ({
      attacks: s.attacks.map((a, i) => (i === index ? attack : a)),
    })),
  reset: () => set(initialState),
}));
