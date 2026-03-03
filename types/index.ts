export type WorkoutPhase = 'cut' | 'bulk' | 'maintain';

export enum MuscleGroup {
  Chest = 'Chest',
  Back = 'Back',
  Legs = 'Legs',
  Shoulders = 'Shoulders',
  Arms = 'Arms',
  Core = 'Core',
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: MuscleGroup;
  is_custom: 0 | 1;
}

export interface Routine {
  id: number;
  name: string;
  days_per_week: number;
  created_at: string;
}

export interface RoutineDay {
  id: number;
  routine_id: number;
  day_order: number;
  name: string;
}

export interface RoutineDayExercise {
  id: number;
  routine_day_id: number;
  exercise_id: number;
  order_index: number;
  target_sets: number;
  target_reps: number;
  target_weight: number;
}

export interface Workout {
  id: number;
  routine_day_id: number | null;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  completed: 0 | 1;
  rpe: number | null;
}

export interface BodyWeightEntry {
  id: number;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
}

export interface PersonalRecord {
  id: number;
  exercise_id: number;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  achieved_at: string;
}

// ─── Active workout in-memory types ───────────────────────────────────────

export interface ActiveSet {
  setNumber: number;
  weight: string;
  reps: string;
  completed: boolean;
}

export interface ActiveExercise {
  exerciseId: number;
  exerciseName: string;
  sets: ActiveSet[];
}

export interface ActiveWorkout {
  id: number;
  startedAt: string;
  routineDayId: number | null;
  exercises: ActiveExercise[];
}

// ─── Query result types ────────────────────────────────────────────────────

export interface LastPerformanceSet {
  weight_kg: number;
  reps: number;
  set_number: number;
}

export interface WorkoutSummaryData {
  workoutId: number;
  durationSeconds: number;
  exerciseCount: number;
  totalSets: number;
  totalVolumeKg: number;
  newPRs: PRResult[];
}

export interface PRResult {
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1rm: number;
}

// ─── Routine nested types ──────────────────────────────────────────────────

export interface RoutineDayExerciseWithName extends RoutineDayExercise {
  exercise_name: string;
}

export interface RoutineDayWithExercises extends RoutineDay {
  exercises: RoutineDayExerciseWithName[];
}

export interface RoutineWithDays extends Routine {
  days: RoutineDayWithExercises[];
}
