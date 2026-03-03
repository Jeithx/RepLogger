import { create } from 'zustand';
import { BodyWeightEntry } from '../types';

interface BodyWeightStore {
  entries: BodyWeightEntry[];
  setEntries: (entries: BodyWeightEntry[]) => void;
  addEntry: (entry: BodyWeightEntry) => void;
  removeEntry: (id: number) => void;
}

export const useBodyWeightStore = create<BodyWeightStore>((set) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),
  removeEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
}));
