import { getDatabase } from './database';
import { Exercise, MuscleGroup } from '../types';

export interface DeleteResult {
  canDelete: boolean;
  usageCount?: number;
}

export function createCustomExercise(name: string, muscleGroup: MuscleGroup): number {
  const db = getDatabase();
  const result = db.runSync(
    'INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 1)',
    [name, muscleGroup]
  );
  return result.lastInsertRowId;
}

export function updateCustomExercise(id: number, name: string, muscleGroup: MuscleGroup): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE exercises SET name = ?, muscle_group = ? WHERE id = ? AND is_custom = 1',
    [name, muscleGroup, id]
  );
}

export function deleteCustomExercise(id: number): DeleteResult {
  const db = getDatabase();
  const routineUsage = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM routine_day_exercises WHERE exercise_id = ?',
    [id]
  );
  const workoutUsage = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workout_sets WHERE exercise_id = ?',
    [id]
  );
  const usageCount = (routineUsage?.count ?? 0) + (workoutUsage?.count ?? 0);
  if (usageCount > 0) {
    return { canDelete: false, usageCount };
  }
  db.runSync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
  return { canDelete: true };
}

export function getAllExercises(): Exercise[] {
  const db = getDatabase();
  return db.getAllSync<Exercise>(
    'SELECT id, name, muscle_group, is_custom FROM exercises ORDER BY muscle_group, name'
  );
}

export function exerciseNameExists(name: string, excludeId?: number): boolean {
  const db = getDatabase();
  if (excludeId !== undefined) {
    const row = db.getFirstSync<{ count: number }>(
      "SELECT COUNT(*) as count FROM exercises WHERE lower(name) = lower(?) AND id != ?",
      [name, excludeId]
    );
    return (row?.count ?? 0) > 0;
  }
  const row = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM exercises WHERE lower(name) = lower(?)",
    [name]
  );
  return (row?.count ?? 0) > 0;
}
