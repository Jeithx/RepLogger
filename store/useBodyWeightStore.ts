import { create } from 'zustand';
import { BodyWeightEntry, BodyWeightStats, PhaseInfo, WorkoutPhase } from '../types';
import {
  insertBodyWeight,
  deleteBodyWeightEntry,
  getBodyWeightEntries,
  getBodyWeightStats,
  getMovingAverage,
} from '../db/bodyWeightQueries';
import { setPhase as setPhaseDB, getPhaseInfo } from '../db/settingsQueries';

const PAGE_SIZE = 30;

interface BodyWeightStore {
  entries: BodyWeightEntry[];
  hasMore: boolean;
  movingAverage: { date: string; average: number }[];
  stats: BodyWeightStats | null;
  phaseInfo: PhaseInfo | null;

  logWeight: (weightKg: number, notes?: string) => void;
  deleteEntry: (id: number) => void;
  loadEntries: () => void;
  loadMoreEntries: () => void;
  loadStats: () => void;
  loadMovingAverage: (days: 7 | 14 | 30) => void;
  setPhase: (phase: WorkoutPhase | '', goalWeight?: number) => void;
  loadPhaseInfo: () => void;
}

export const useBodyWeightStore = create<BodyWeightStore>((set, get) => ({
  entries: [],
  hasMore: true,
  movingAverage: [],
  stats: null,
  phaseInfo: null,

  logWeight: (weightKg: number, notes?: string) => {
    try {
      insertBodyWeight(weightKg, notes);
      const fresh = getBodyWeightEntries(PAGE_SIZE, 0);
      set({ entries: fresh, hasMore: fresh.length === PAGE_SIZE, stats: getBodyWeightStats() });
      get().loadMovingAverage(7);
    } catch (error) {
      console.error('logWeight failed:', error);
    }
  },

  deleteEntry: (id: number) => {
    deleteBodyWeightEntry(id);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
    set({ stats: getBodyWeightStats() });
    get().loadMovingAverage(7);
  },

  loadEntries: () => {
    const data = getBodyWeightEntries(PAGE_SIZE, 0);
    set({ entries: data, hasMore: data.length === PAGE_SIZE });
  },

  loadMoreEntries: () => {
    const { entries, hasMore } = get();
    if (!hasMore) return;
    const more = getBodyWeightEntries(PAGE_SIZE, entries.length);
    set({ entries: [...entries, ...more], hasMore: more.length === PAGE_SIZE });
  },

  loadStats: () => {
    set({ stats: getBodyWeightStats() });
  },

  loadMovingAverage: (days: 7 | 14 | 30) => {
    set({ movingAverage: getMovingAverage(days) });
  },

  setPhase: (phase: WorkoutPhase | '', goalWeight?: number) => {
    setPhaseDB(phase, goalWeight);
    set({ phaseInfo: getPhaseInfo() });
  },

  loadPhaseInfo: () => {
    set({ phaseInfo: getPhaseInfo() });
  },
}));
