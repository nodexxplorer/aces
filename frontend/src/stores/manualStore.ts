import { create } from 'zustand';
import type { Manual } from '../types';

interface ManualState {
  manuals: Manual[];
  selectedManual: Manual | null;
  setManuals: (manuals: Manual[]) => void;
  setSelectedManual: (manual: Manual | null) => void;
  updateManual: (id: string, partial: Partial<Manual>) => void;
}

export const useManualStore = create<ManualState>()((set) => ({
  manuals: [],
  selectedManual: null,
  setManuals: (manuals) => set({ manuals }),
  setSelectedManual: (selectedManual) => set({ selectedManual }),
  updateManual: (id, partial) =>
    set((state) => ({
      manuals: state.manuals.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    })),
}));
