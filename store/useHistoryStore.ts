import { create } from 'zustand';
import { WorkoutSummary, WorkoutDetail, PRWithName, StatsOverviewData } from '../types';
import {
  getWorkoutHistory,
  getWorkoutDetail,
  getAllPRs,
  getStatsOverview,
  PAGE_SIZE,
} from '../db/historyQueries';
import { deleteWorkoutDB } from '../db/workoutQueries';

interface HistoryStore {
  workouts: WorkoutSummary[];
  isLoadingMore: boolean;
  hasMore: boolean;
  selectedWorkout: WorkoutDetail | null;
  prs: PRWithName[];
  stats: StatsOverviewData;

  loadWorkouts: (refresh?: boolean) => void;
  loadMoreWorkouts: () => void;
  loadWorkoutDetail: (id: number) => void;
  clearSelectedWorkout: () => void;
  loadPRs: () => void;
  loadStats: () => void;
  deleteWorkout: (id: number) => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  workouts: [],
  isLoadingMore: false,
  hasMore: true,
  selectedWorkout: null,
  prs: [],
  stats: { thisWeekCount: 0, thisMonthVolume: 0, streakWeeks: 0, totalWorkouts: 0 },

  loadWorkouts: () => {
    const data = getWorkoutHistory(PAGE_SIZE, 0);
    set({ workouts: data, hasMore: data.length === PAGE_SIZE, isLoadingMore: false });
  },

  loadMoreWorkouts: () => {
    const { workouts, hasMore, isLoadingMore } = get();
    if (!hasMore || isLoadingMore) return;
    set({ isLoadingMore: true });
    const more = getWorkoutHistory(PAGE_SIZE, workouts.length);
    set({
      workouts: [...workouts, ...more],
      hasMore: more.length === PAGE_SIZE,
      isLoadingMore: false,
    });
  },

  loadWorkoutDetail: (id: number) => {
    const detail = getWorkoutDetail(id);
    set({ selectedWorkout: detail });
  },

  clearSelectedWorkout: () => set({ selectedWorkout: null }),

  loadPRs: () => {
    const prs = getAllPRs();
    set({ prs });
  },

  loadStats: () => {
    const stats = getStatsOverview();
    set({ stats });
  },

  deleteWorkout: (id: number) => {
    deleteWorkoutDB(id);
    set((state) => ({ workouts: state.workouts.filter((w) => w.id !== id) }));
  },
}));
