import { getDatabase } from './database';
import { Workout, WorkoutSet, LastPerformanceSet, PRResult } from '../types';

export function createWorkoutDB(routineDayId: number | null): number {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'INSERT INTO workouts (routine_day_id) VALUES (?);',
      [routineDayId]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('createWorkoutDB failed:', error);
    throw error;
  }
}

export function finishWorkoutDB(workoutId: number, finishedAt: string): void {
  try {
    const db = getDatabase();
    db.runSync(
      'UPDATE workouts SET finished_at = ? WHERE id = ?;',
      [finishedAt, workoutId]
    );
  } catch (error) {
    console.error('finishWorkoutDB failed:', error);
  }
}

export function deleteWorkoutDB(workoutId: number): void {
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM workouts WHERE id = ?;', [workoutId]);
  } catch (error) {
    console.error('deleteWorkoutDB failed:', error);
  }
}

export function insertWorkoutSet(
  workoutId: number,
  exerciseId: number,
  setNumber: number,
  weightKg: number,
  reps: number
): void {
  try {
    const db = getDatabase();
    db.runSync(
      'INSERT INTO workout_sets (workout_id, exercise_id, set_number, weight_kg, reps, completed) VALUES (?, ?, ?, ?, ?, 1);',
      [workoutId, exerciseId, setNumber, weightKg, reps]
    );
  } catch (error) {
    console.error('insertWorkoutSet failed:', error);
  }
}

export function getRecentWorkouts(limit: number): Workout[] {
  try {
    const db = getDatabase();
    return db.getAllSync<Workout>(
      'SELECT * FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT ?;',
      [limit]
    );
  } catch (error) {
    console.error('getRecentWorkouts failed:', error);
    return [];
  }
}

export function getWorkoutById(workoutId: number): Workout | null {
  try {
    const db = getDatabase();
    return db.getFirstSync<Workout>('SELECT * FROM workouts WHERE id = ?;', [workoutId]);
  } catch (error) {
    console.error('getWorkoutById failed:', error);
    return null;
  }
}

export function getWorkoutSets(workoutId: number): WorkoutSet[] {
  try {
    const db = getDatabase();
    return db.getAllSync<WorkoutSet>(
      'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY exercise_id, set_number;',
      [workoutId]
    );
  } catch (error) {
    console.error('getWorkoutSets failed:', error);
    return [];
  }
}

export function getLastPerformance(exerciseId: number): LastPerformanceSet[] {
  try {
    const db = getDatabase();
    const lastWorkout = db.getFirstSync<{ workout_id: number }>(
      `SELECT ws.workout_id
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ?
         AND w.finished_at IS NOT NULL
       ORDER BY w.finished_at DESC
       LIMIT 1;`,
      [exerciseId]
    );

    if (!lastWorkout) return [];

    return db.getAllSync<LastPerformanceSet>(
      'SELECT weight_kg, reps, set_number FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number;',
      [lastWorkout.workout_id, exerciseId]
    );
  } catch (error) {
    console.error('getLastPerformance failed:', error);
    return [];
  }
}

export function checkAndSavePR(
  exerciseId: number,
  weightKg: number,
  reps: number
): Omit<PRResult, 'exerciseName'> | null {
  try {
    const db = getDatabase();
    const estimated1rm = weightKg * (1 + reps / 30);

    const existing = db.getFirstSync<{ estimated_1rm: number }>(
      'SELECT estimated_1rm FROM personal_records WHERE exercise_id = ? ORDER BY estimated_1rm DESC LIMIT 1;',
      [exerciseId]
    );

    if (existing && existing.estimated_1rm >= estimated1rm) {
      return null;
    }

    db.runSync(
      'INSERT INTO personal_records (exercise_id, weight_kg, reps, estimated_1rm) VALUES (?, ?, ?, ?);',
      [exerciseId, weightKg, reps, estimated1rm]
    );

    return { weightKg, reps, estimated1rm };
  } catch (error) {
    console.error('checkAndSavePR failed:', error);
    return null;
  }
}
