import { create } from 'zustand';
import { Exercise, MuscleGroup } from '../types';
import {
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  getAllExercises,
  DeleteResult,
} from '../db/exerciseQueries';

interface ExerciseStore {
  exercises: Exercise[];
  isLoading: boolean;
  loadExercises: () => void;
  createExercise: (name: string, muscleGroup: MuscleGroup) => Exercise;
  updateExercise: (id: number, name: string, muscleGroup: MuscleGroup) => void;
  deleteExercise: (id: number) => DeleteResult;
  searchExercises: (query: string) => Exercise[];
}

function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) =>
    a.muscle_group !== b.muscle_group
      ? a.muscle_group.localeCompare(b.muscle_group)
      : a.name.localeCompare(b.name)
  );
}

export const useExerciseStore = create<ExerciseStore>((set, get) => ({
  exercises: [],
  isLoading: false,

  loadExercises: () => {
    try {
      set({ isLoading: true });
      const exercises = getAllExercises();
      set({ exercises, isLoading: false });
    } catch (e) {
      console.error('loadExercises failed:', e);
      set({ isLoading: false });
    }
  },

  createExercise: (name, muscleGroup) => {
    const id = createCustomExercise(name, muscleGroup);
    const newExercise: Exercise = { id, name, muscle_group: muscleGroup, is_custom: 1 };
    set((s) => ({ exercises: sortExercises([...s.exercises, newExercise]) }));
    return newExercise;
  },

  updateExercise: (id, name, muscleGroup) => {
    updateCustomExercise(id, name, muscleGroup);
    set((s) => ({
      exercises: sortExercises(
        s.exercises.map((e) => (e.id === id ? { ...e, name, muscle_group: muscleGroup } : e))
      ),
    }));
  },

  deleteExercise: (id) => {
    const result = deleteCustomExercise(id);
    if (result.canDelete) {
      set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) }));
    }
    return result;
  },

  searchExercises: (query) => {
    const { exercises } = get();
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  },
}));
