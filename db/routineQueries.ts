import { getDatabase } from './database';
import { getSetting } from './settingsQueries';
import {
  Routine,
  RoutineDay,
  RoutineDayExerciseWithName,
  RoutineDayWithExercises,
  RoutineWithDays,
} from '../types';
import { RoutineTemplate } from '../constants/routineTemplates';

// ─── Routine CRUD ──────────────────────────────────────────────────────────

export function createRoutine(name: string, daysPerWeek: number): number {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'INSERT INTO routines (name, days_per_week) VALUES (?, ?);',
      [name, daysPerWeek]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('createRoutine failed:', error);
    throw error;
  }
}

export function updateRoutine(id: number, name: string): void {
  try {
    const db = getDatabase();
    db.runSync('UPDATE routines SET name = ? WHERE id = ?;', [name, id]);
  } catch (error) {
    console.error('updateRoutine failed:', error);
  }
}

export function deleteRoutine(id: number): void {
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM routines WHERE id = ?;', [id]);
  } catch (error) {
    console.error('deleteRoutine failed:', error);
  }
}

export function getAllRoutinesWithDays(): RoutineWithDays[] {
  try {
    const db = getDatabase();
    const routines = db.getAllSync<Routine>('SELECT * FROM routines ORDER BY created_at DESC;');
    return routines.map((r) => buildRoutineWithDays(r));
  } catch (error) {
    console.error('getAllRoutinesWithDays failed:', error);
    return [];
  }
}

export function getRoutineWithDaysById(id: number): RoutineWithDays | null {
  try {
    const db = getDatabase();
    const routine = db.getFirstSync<Routine>('SELECT * FROM routines WHERE id = ?;', [id]);
    if (!routine) return null;
    return buildRoutineWithDays(routine);
  } catch (error) {
    console.error('getRoutineWithDaysById failed:', error);
    return null;
  }
}

function buildRoutineWithDays(routine: Routine): RoutineWithDays {
  const db = getDatabase();
  const days = db.getAllSync<RoutineDay>(
    'SELECT * FROM routine_days WHERE routine_id = ? ORDER BY day_order;',
    [routine.id]
  );
  const daysWithExercises: RoutineDayWithExercises[] = days.map((d) => ({
    ...d,
    exercises: getRoutineDayExercisesWithNames(d.id),
  }));
  return { ...routine, days: daysWithExercises };
}

// ─── Routine Day CRUD ──────────────────────────────────────────────────────

export function addRoutineDay(routineId: number, dayOrder: number, name: string): number {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'INSERT INTO routine_days (routine_id, day_order, name) VALUES (?, ?, ?);',
      [routineId, dayOrder, name]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('addRoutineDay failed:', error);
    throw error;
  }
}

export function updateRoutineDayName(dayId: number, name: string): void {
  try {
    const db = getDatabase();
    db.runSync('UPDATE routine_days SET name = ? WHERE id = ?;', [name, dayId]);
  } catch (error) {
    console.error('updateRoutineDayName failed:', error);
  }
}

// ─── Routine Day Exercises ─────────────────────────────────────────────────

export function getRoutineDayExercisesWithNames(routineDayId: number): RoutineDayExerciseWithName[] {
  try {
    const db = getDatabase();
    return db.getAllSync<RoutineDayExerciseWithName>(
      `SELECT rde.*, e.name AS exercise_name
       FROM routine_day_exercises rde
       JOIN exercises e ON e.id = rde.exercise_id
       WHERE rde.routine_day_id = ?
       ORDER BY rde.order_index;`,
      [routineDayId]
    );
  } catch (error) {
    console.error('getRoutineDayExercisesWithNames failed:', error);
    return [];
  }
}

export function addExerciseToDay(
  routineDayId: number,
  exerciseId: number,
  orderIndex: number,
  targetSets: number,
  targetReps: number,
  targetWeight: number
): number {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'INSERT INTO routine_day_exercises (routine_day_id, exercise_id, order_index, target_sets, target_reps, target_weight) VALUES (?, ?, ?, ?, ?, ?);',
      [routineDayId, exerciseId, orderIndex, targetSets, targetReps, targetWeight]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('addExerciseToDay failed:', error);
    throw error;
  }
}

export function removeExerciseFromDay(routineDayId: number, exerciseId: number): void {
  try {
    const db = getDatabase();
    db.runSync(
      'DELETE FROM routine_day_exercises WHERE routine_day_id = ? AND exercise_id = ?;',
      [routineDayId, exerciseId]
    );
  } catch (error) {
    console.error('removeExerciseFromDay failed:', error);
  }
}

export function reorderExercisesInDay(routineDayId: number, exerciseIds: number[]): void {
  try {
    const db = getDatabase();
    const stmt = db.prepareSync(
      'UPDATE routine_day_exercises SET order_index = ? WHERE routine_day_id = ? AND exercise_id = ?;'
    );
    try {
      exerciseIds.forEach((exId, idx) => {
        stmt.executeSync([idx, routineDayId, exId]);
      });
    } finally {
      stmt.finalizeSync();
    }
  } catch (error) {
    console.error('reorderExercisesInDay failed:', error);
  }
}

// ─── Today's day logic ─────────────────────────────────────────────────────

export function getTodaysRoutineDay(routineId: number): RoutineDayWithExercises | null {
  try {
    const db = getDatabase();
    const days = db.getAllSync<RoutineDay>(
      'SELECT * FROM routine_days WHERE routine_id = ? ORDER BY day_order;',
      [routineId]
    );
    if (days.length === 0) return null;

    const daysWithEx: RoutineDayWithExercises[] = days.map((d) => ({
      ...d,
      exercises: getRoutineDayExercisesWithNames(d.id),
    }));

    const nonRestDays = daysWithEx.filter((d) => d.exercises.length > 0);
    if (nonRestDays.length === 0) return null;

    const lastUsedIdStr = getSetting('last_used_routine_day_id');
    if (!lastUsedIdStr) return nonRestDays[0];

    const lastUsedId = parseInt(lastUsedIdStr, 10);
    const lastIndex = nonRestDays.findIndex((d) => d.id === lastUsedId);
    if (lastIndex === -1) return nonRestDays[0];

    const nextIndex = (lastIndex + 1) % nonRestDays.length;
    return nonRestDays[nextIndex];
  } catch (error) {
    console.error('getTodaysRoutineDay failed:', error);
    return null;
  }
}

// ─── Template application ──────────────────────────────────────────────────

export function getExerciseIdByName(name: string): number | null {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<{ id: number }>(
      'SELECT id FROM exercises WHERE name = ? LIMIT 1;',
      [name]
    );
    return row?.id ?? null;
  } catch (error) {
    console.error('getExerciseIdByName failed:', error);
    return null;
  }
}

export function applyTemplate(
  dayIds: number[],
  template: RoutineTemplate
): void {
  try {
    for (let dayIdx = 0; dayIdx < template.days.length; dayIdx++) {
      const templateDay = template.days[dayIdx];
      const dbDayId = dayIds[dayIdx];
      if (!dbDayId) continue;

      templateDay.exercises.forEach((ex, orderIdx) => {
        const exerciseId = getExerciseIdByName(ex.name);
        if (!exerciseId) return;
        addExerciseToDay(dbDayId, exerciseId, orderIdx, ex.sets, ex.reps, ex.weight);
      });
    }
  } catch (error) {
    console.error('applyTemplate failed:', error);
  }
}
