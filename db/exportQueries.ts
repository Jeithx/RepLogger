import { getDatabase } from './database';

interface WorkoutSetExportRow {
  date: string;
  exercise: string;
  muscleGroup: string;
  set: number;
  weightKg: number;
  reps: number;
}

interface BodyWeightExportRow {
  date: string;
  weightKg: number;
  notes: string | null;
}

export function getWorkoutSetsForExport(): WorkoutSetExportRow[] {
  const db = getDatabase();
  try {
    return db.getAllSync<WorkoutSetExportRow>(`
      SELECT
        substr(w.started_at, 1, 10) AS date,
        e.name AS exercise,
        e.muscle_group AS muscleGroup,
        ws.set_number AS set,
        ws.weight_kg AS weightKg,
        ws.reps AS reps
      FROM workout_sets ws
      JOIN workouts w ON ws.workout_id = w.id
      JOIN exercises e ON ws.exercise_id = e.id
      WHERE w.finished_at IS NOT NULL
      ORDER BY w.started_at ASC, e.name, ws.set_number
    `);
  } catch {
    return [];
  }
}

export function getBodyWeightForExport(): BodyWeightExportRow[] {
  const db = getDatabase();
  try {
    return db.getAllSync<BodyWeightExportRow>(`
      SELECT
        substr(recorded_at, 1, 10) AS date,
        weight_kg AS weightKg,
        notes
      FROM body_weight_entries
      ORDER BY recorded_at ASC
    `);
  } catch {
    return [];
  }
}

export function clearAllUserData(): void {
  const db = getDatabase();
  db.execSync(`
    DELETE FROM workout_sets;
    DELETE FROM workouts;
    DELETE FROM personal_records;
    DELETE FROM body_weight_entries;
    DELETE FROM routine_day_exercises;
    DELETE FROM routine_days;
    DELETE FROM routines;
    UPDATE app_settings SET value = '' WHERE key IN (
      'active_routine_id',
      'last_used_routine_day_id',
      'current_phase',
      'phase_start_date',
      'phase_goal_weight',
      'onboarding_complete'
    );
  `);
}
