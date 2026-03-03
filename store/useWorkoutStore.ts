import { create } from 'zustand';
import { ActiveWorkout, ActiveSet, ActiveExercise, PRResult } from '../types';
import {
  createWorkoutDB,
  finishWorkoutDB,
  deleteWorkoutDB,
  insertWorkoutSet,
  checkAndSavePR,
} from '../db/workoutQueries';
import { getRoutineDayExercisesWithNames } from '../db/routineQueries';
import { setSetting, getSetting } from '../db/settingsQueries';
import { displayToKg, kgToDisplay } from '../utils/weightUtils';
import { useHistoryStore } from './useHistoryStore';

interface SummaryData {
  workoutId: number;
  durationSeconds: number;
  exerciseCount: number;
  totalSets: number;
  totalVolumeKg: number;
  newPRs: PRResult[];
}

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  elapsedSeconds: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  summaryData: SummaryData | null;

  startWorkout: (routineDayId?: number) => void;
  addExercise: (exerciseId: number, exerciseName: string) => void;
  removeExercise: (exerciseId: number) => void;
  updateSet: (exerciseId: number, setNumber: number, field: 'weight' | 'reps', value: string) => void;
  toggleSetComplete: (exerciseId: number, setNumber: number) => void;
  addSet: (exerciseId: number) => void;
  removeSet: (exerciseId: number, setNumber: number) => void;
  reorderExercises: (exercises: ActiveExercise[]) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  clearSummary: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  activeWorkout: null,
  elapsedSeconds: 0,
  timerInterval: null,
  summaryData: null,

  startWorkout: (routineDayId?: number) => {
    try {
      const workoutId = createWorkoutDB(routineDayId ?? null);
      const interval = setInterval(() => {
        set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
      }, 1000);

      const savedUnit = getSetting('weight_unit');
      const unit = savedUnit === 'lbs' ? 'lbs' : 'kg';

      let exercises: ActiveExercise[] = [];
      if (routineDayId) {
        const routineExercises = getRoutineDayExercisesWithNames(routineDayId);
        exercises = routineExercises.map((re) => ({
          exerciseId: re.exercise_id,
          exerciseName: re.exercise_name,
          sets: Array.from({ length: re.target_sets }, (_, i) => ({
            setNumber: i + 1,
            weight: re.target_weight > 0 ? String(kgToDisplay(re.target_weight, unit)) : '',
            reps: re.target_reps > 0 ? String(re.target_reps) : '',
            completed: false,
          })),
        }));
      }

      set({
        activeWorkout: {
          id: workoutId,
          startedAt: new Date().toISOString(),
          routineDayId: routineDayId ?? null,
          exercises,
        },
        elapsedSeconds: 0,
        timerInterval: interval,
        summaryData: null,
      });
    } catch (error) {
      console.error('Failed to start workout:', error);
    }
  },

  addExercise: (exerciseId: number, exerciseName: string) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      if (state.activeWorkout.exercises.some((e) => e.exerciseId === exerciseId)) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: [
            ...state.activeWorkout.exercises,
            {
              exerciseId,
              exerciseName,
              sets: [{ setNumber: 1, weight: '', reps: '', completed: false }],
            },
          ],
        },
      };
    });
  },

  removeExercise: (exerciseId: number) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.filter((e) => e.exerciseId !== exerciseId),
        },
      };
    });
  },

  updateSet: (exerciseId: number, setNumber: number, field: 'weight' | 'reps', value: string) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map((ex) =>
            ex.exerciseId !== exerciseId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.setNumber === setNumber ? { ...s, [field]: value } : s
                  ),
                }
          ),
        },
      };
    });
  },

  toggleSetComplete: (exerciseId: number, setNumber: number) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map((ex) =>
            ex.exerciseId !== exerciseId
              ? ex
              : {
                  ...ex,
                  sets: ex.sets.map((s) =>
                    s.setNumber === setNumber ? { ...s, completed: !s.completed } : s
                  ),
                }
          ),
        },
      };
    });
  },

  addSet: (exerciseId: number) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map((ex) => {
            if (ex.exerciseId !== exerciseId) return ex;
            const last = ex.sets[ex.sets.length - 1];
            const newSet: ActiveSet = {
              setNumber: ex.sets.length + 1,
              weight: last?.weight ?? '',
              reps: last?.reps ?? '',
              completed: false,
            };
            return { ...ex, sets: [...ex.sets, newSet] };
          }),
        },
      };
    });
  },

  removeSet: (exerciseId: number, setNumber: number) => {
    set((state) => {
      if (!state.activeWorkout) return state;
      return {
        activeWorkout: {
          ...state.activeWorkout,
          exercises: state.activeWorkout.exercises.map((ex) => {
            if (ex.exerciseId !== exerciseId) return ex;
            const filtered = ex.sets.filter((s) => s.setNumber !== setNumber);
            return { ...ex, sets: filtered.map((s, i) => ({ ...s, setNumber: i + 1 })) };
          }),
        },
      };
    });
  },

  reorderExercises: (exercises: ActiveExercise[]) => {
    set((state) => ({
      activeWorkout: state.activeWorkout ? { ...state.activeWorkout, exercises } : null,
    }));
  },

  finishWorkout: async () => {
    const { activeWorkout, elapsedSeconds, timerInterval } = get();
    if (!activeWorkout) return;

    if (timerInterval) clearInterval(timerInterval);

    try {
      finishWorkoutDB(activeWorkout.id, new Date().toISOString());

      const finishUnit = getSetting('weight_unit') === 'lbs' ? 'lbs' : 'kg';
      const newPRs: PRResult[] = [];
      let totalSets = 0;
      let totalVolumeKg = 0;

      for (const exercise of activeWorkout.exercises) {
        for (const s of exercise.sets) {
          if (!s.completed) continue;
          const weightKg = displayToKg(parseFloat(s.weight) || 0, finishUnit);
          const reps = parseInt(s.reps, 10) || 0;
          if (reps === 0) continue;

          insertWorkoutSet(activeWorkout.id, exercise.exerciseId, s.setNumber, weightKg, reps);
          totalSets += 1;
          totalVolumeKg += weightKg * reps;

          const pr = checkAndSavePR(exercise.exerciseId, weightKg, reps);
          if (pr) {
            newPRs.push({ ...pr, exerciseName: exercise.exerciseName });
          }
        }
      }

      if (activeWorkout.routineDayId) {
        setSetting('last_used_routine_day_id', String(activeWorkout.routineDayId));
      }

      useHistoryStore.getState().loadPRs();

      set({
        activeWorkout: null,
        elapsedSeconds: 0,
        timerInterval: null,
        summaryData: {
          workoutId: activeWorkout.id,
          durationSeconds: elapsedSeconds,
          exerciseCount: activeWorkout.exercises.length,
          totalSets,
          totalVolumeKg,
          newPRs,
        },
      });
    } catch (error) {
      console.error('Failed to finish workout:', error);
    }
  },

  discardWorkout: () => {
    const { timerInterval, activeWorkout } = get();
    if (timerInterval) clearInterval(timerInterval);
    if (activeWorkout) {
      try {
        deleteWorkoutDB(activeWorkout.id);
      } catch (error) {
        console.error('Failed to delete workout on discard:', error);
      }
    }
    set({ activeWorkout: null, elapsedSeconds: 0, timerInterval: null, summaryData: null });
  },

  clearSummary: () => set({ summaryData: null }),
}));
