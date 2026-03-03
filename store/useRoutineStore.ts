import { create } from 'zustand';
import { RoutineWithDays, RoutineDayWithExercises } from '../types';
import {
  getAllRoutinesWithDays,
  createRoutine as createRoutineDB,
  deleteRoutine as deleteRoutineDB,
  addRoutineDay,
  addExerciseToDay as addExerciseToDayDB,
  removeExerciseFromDay as removeExerciseFromDayDB,
  getTodaysRoutineDay,
} from '../db/routineQueries';
import { getSetting, setSetting } from '../db/settingsQueries';

interface RoutineStore {
  routines: RoutineWithDays[];
  activeRoutineId: number | null;
  todaysRoutineDay: RoutineDayWithExercises | null;
  isLoading: boolean;

  loadRoutines: () => void;
  setActiveRoutine: (id: number | null) => void;
  createRoutine: (name: string, daysPerWeek: number) => RoutineWithDays;
  deleteRoutine: (id: number) => void;
  loadTodaysDay: () => void;
  addDay: (routineId: number, name: string) => void;
  addExerciseToDay: (
    routineDayId: number,
    exerciseId: number,
    targetSets: number,
    targetReps: number,
    targetWeight: number
  ) => void;
  removeExerciseFromDay: (routineDayId: number, exerciseId: number) => void;
  skipDay: () => void;
}

export const useRoutineStore = create<RoutineStore>((set, get) => ({
  routines: [],
  activeRoutineId: null,
  todaysRoutineDay: null,
  isLoading: false,

  loadRoutines: () => {
    set({ isLoading: true });
    try {
      const routines = getAllRoutinesWithDays();
      const activeIdStr = getSetting('active_routine_id');
      const activeRoutineId = activeIdStr ? parseInt(activeIdStr, 10) : null;
      set({ routines, activeRoutineId, isLoading: false });
    } catch (error) {
      console.error('loadRoutines failed:', error);
      set({ isLoading: false });
    }
  },

  setActiveRoutine: (id: number | null) => {
    try {
      setSetting('active_routine_id', id !== null ? String(id) : '');
      setSetting('last_used_routine_day_id', '');
      set({ activeRoutineId: id, todaysRoutineDay: null });
      if (id !== null) {
        get().loadTodaysDay();
      }
    } catch (error) {
      console.error('setActiveRoutine failed:', error);
    }
  },

  createRoutine: (name: string, daysPerWeek: number): RoutineWithDays => {
    const id = createRoutineDB(name, daysPerWeek);
    const newRoutine: RoutineWithDays = {
      id,
      name,
      days_per_week: daysPerWeek,
      created_at: new Date().toISOString(),
      days: [],
    };
    set((state) => ({ routines: [newRoutine, ...state.routines] }));
    return newRoutine;
  },

  deleteRoutine: (id: number) => {
    try {
      deleteRoutineDB(id);
      set((state) => {
        const routines = state.routines.filter((r) => r.id !== id);
        const activeRoutineId = state.activeRoutineId === id ? null : state.activeRoutineId;
        if (state.activeRoutineId === id) {
          setSetting('active_routine_id', '');
        }
        return { routines, activeRoutineId };
      });
    } catch (error) {
      console.error('deleteRoutine store failed:', error);
    }
  },

  loadTodaysDay: () => {
    const { activeRoutineId } = get();
    if (!activeRoutineId) {
      set({ todaysRoutineDay: null });
      return;
    }
    try {
      const day = getTodaysRoutineDay(activeRoutineId);
      set({ todaysRoutineDay: day });
    } catch (error) {
      console.error('loadTodaysDay failed:', error);
    }
  },

  addDay: (routineId: number, name: string) => {
    try {
      const existing = get().routines.find((r) => r.id === routineId);
      const nextOrder = existing ? existing.days.length + 1 : 1;
      addRoutineDay(routineId, nextOrder, name);
      get().loadRoutines();
    } catch (error) {
      console.error('addDay failed:', error);
    }
  },

  addExerciseToDay: (
    routineDayId: number,
    exerciseId: number,
    targetSets: number,
    targetReps: number,
    targetWeight: number
  ) => {
    try {
      const day = get()
        .routines.flatMap((r) => r.days)
        .find((d) => d.id === routineDayId);
      const nextOrder = day ? day.exercises.length : 0;
      addExerciseToDayDB(routineDayId, exerciseId, nextOrder, targetSets, targetReps, targetWeight);
      get().loadRoutines();
    } catch (error) {
      console.error('addExerciseToDay store failed:', error);
    }
  },

  removeExerciseFromDay: (routineDayId: number, exerciseId: number) => {
    try {
      removeExerciseFromDayDB(routineDayId, exerciseId);
      get().loadRoutines();
    } catch (error) {
      console.error('removeExerciseFromDay store failed:', error);
    }
  },

  skipDay: () => {
    const { todaysRoutineDay, activeRoutineId } = get();
    if (!todaysRoutineDay || !activeRoutineId) return;
    try {
      setSetting('last_used_routine_day_id', String(todaysRoutineDay.id));
      get().loadTodaysDay();
    } catch (error) {
      console.error('skipDay failed:', error);
    }
  },
}));
