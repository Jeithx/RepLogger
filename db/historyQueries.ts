import { getDatabase } from './database';
import {
  WorkoutSummary,
  WorkoutDetail,
  WorkoutDetailExercise,
  ExerciseSession,
  BestSetPerSession,
  PRWithName,
  WeeklyVolume,
  MuscleGroupVolume,
  StatsOverviewData,
  PersonalRecord,
} from '../types';

function parseDateMs(s: string): number {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
}

function getWeekStart(dateStr: string): string {
  const ms = parseDateMs(dateStr);
  const d = new Date(ms);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(ms + diff * 86400000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

const PAGE_SIZE = 20;

export function getWorkoutHistory(limit: number, offset: number): WorkoutSummary[] {
  try {
    const db = getDatabase();
    interface RawRow {
      id: number;
      started_at: string;
      finished_at: string;
      exerciseCount: number;
      totalVolume: number;
      routineDayName: string | null;
      exerciseNames: string | null;
    }
    const rows = db.getAllSync<RawRow>(
      `SELECT w.id, w.started_at, w.finished_at,
              COUNT(DISTINCT ws.exercise_id) as exerciseCount,
              COALESCE(SUM(ws.weight_kg * ws.reps), 0) as totalVolume,
              rd.name as routineDayName,
              GROUP_CONCAT(DISTINCT e.name) as exerciseNames
       FROM workouts w
       LEFT JOIN workout_sets ws ON ws.workout_id = w.id
       LEFT JOIN exercises e ON e.id = ws.exercise_id
       LEFT JOIN routine_days rd ON rd.id = w.routine_day_id
       WHERE w.finished_at IS NOT NULL
       GROUP BY w.id
       ORDER BY w.started_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationSeconds: Math.max(
        0,
        Math.floor((parseDateMs(r.finished_at) - parseDateMs(r.started_at)) / 1000)
      ),
      exerciseCount: r.exerciseCount,
      totalVolume: r.totalVolume,
      routineDayName: r.routineDayName,
      exerciseNames: r.exerciseNames ?? '',
    }));
  } catch (error) {
    console.error('getWorkoutHistory failed:', error);
    return [];
  }
}

export { PAGE_SIZE };

export function getWorkoutDetail(workoutId: number): WorkoutDetail | null {
  try {
    const db = getDatabase();
    interface WorkoutRow {
      id: number;
      started_at: string;
      finished_at: string;
      routine_day_name: string | null;
    }
    const workoutRow = db.getFirstSync<WorkoutRow>(
      `SELECT w.id, w.started_at, w.finished_at, rd.name as routine_day_name
       FROM workouts w
       LEFT JOIN routine_days rd ON rd.id = w.routine_day_id
       WHERE w.id = ?`,
      [workoutId]
    );
    if (!workoutRow || !workoutRow.finished_at) return null;

    interface SetRow {
      exercise_id: number;
      exercise_name: string;
      muscle_group: string;
      set_number: number;
      weight_kg: number;
      reps: number;
    }
    const setRows = db.getAllSync<SetRow>(
      `SELECT ws.exercise_id, e.name as exercise_name, e.muscle_group,
              ws.set_number, ws.weight_kg, ws.reps
       FROM workout_sets ws
       JOIN exercises e ON e.id = ws.exercise_id
       WHERE ws.workout_id = ?
       ORDER BY ws.exercise_id, ws.set_number`,
      [workoutId]
    );

    const exerciseMap = new Map<number, WorkoutDetailExercise>();
    for (const row of setRows) {
      if (!exerciseMap.has(row.exercise_id)) {
        exerciseMap.set(row.exercise_id, {
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          muscleGroup: row.muscle_group,
          sets: [],
          totalVolume: 0,
          bestWeightKg: 0,
          bestReps: 0,
        });
      }
      const ex = exerciseMap.get(row.exercise_id)!;
      const vol = row.weight_kg * row.reps;
      ex.sets.push({ setNumber: row.set_number, weightKg: row.weight_kg, reps: row.reps, volume: vol });
      ex.totalVolume += vol;
      const est1rm = row.weight_kg * (1 + row.reps / 30);
      const bestEst = ex.bestWeightKg * (1 + ex.bestReps / 30);
      if (est1rm > bestEst) {
        ex.bestWeightKg = row.weight_kg;
        ex.bestReps = row.reps;
      }
    }

    const exercises = Array.from(exerciseMap.values());
    const totalVolume = exercises.reduce((sum, ex) => sum + ex.totalVolume, 0);

    const workoutDate = workoutRow.started_at.slice(0, 10);
    interface PRRow extends PersonalRecord {
      exerciseName: string;
      muscleGroup: string;
    }
    const prs = db.getAllSync<PRRow>(
      `SELECT pr.id, pr.exercise_id, pr.weight_kg, pr.reps, pr.estimated_1rm, pr.achieved_at,
              e.name as exerciseName, e.muscle_group as muscleGroup
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
       JOIN workout_sets ws ON ws.exercise_id = pr.exercise_id AND ws.workout_id = ?
       WHERE substr(pr.achieved_at, 1, 10) = ?
       GROUP BY pr.exercise_id`,
      [workoutId, workoutDate]
    );

    const durationSeconds = Math.max(
      0,
      Math.floor((parseDateMs(workoutRow.finished_at) - parseDateMs(workoutRow.started_at)) / 1000)
    );

    return {
      id: workoutRow.id,
      startedAt: workoutRow.started_at,
      finishedAt: workoutRow.finished_at,
      durationSeconds,
      totalVolume,
      routineDayName: workoutRow.routine_day_name,
      exercises,
      sessionPRs: prs,
    };
  } catch (error) {
    console.error('getWorkoutDetail failed:', error);
    return null;
  }
}

export function getExerciseHistory(exerciseId: number, limit: number): ExerciseSession[] {
  try {
    const db = getDatabase();
    interface SessionRow {
      workout_id: number;
      started_at: string;
    }
    const sessions = db.getAllSync<SessionRow>(
      `SELECT DISTINCT ws.workout_id, w.started_at
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ? AND w.finished_at IS NOT NULL
       ORDER BY w.started_at DESC
       LIMIT ?`,
      [exerciseId, limit]
    );
    return sessions.map((s) => {
      interface SetRow {
        weight_kg: number;
        reps: number;
      }
      const sets = db.getAllSync<SetRow>(
        `SELECT weight_kg, reps FROM workout_sets
         WHERE workout_id = ? AND exercise_id = ?
         ORDER BY set_number`,
        [s.workout_id, exerciseId]
      );
      return {
        workoutId: s.workout_id,
        date: s.started_at,
        sets: sets.map((ws) => ({
          weightKg: ws.weight_kg,
          reps: ws.reps,
          estimated1rm: ws.weight_kg * (1 + ws.reps / 30),
        })),
      };
    });
  } catch (error) {
    console.error('getExerciseHistory failed:', error);
    return [];
  }
}

export function getBestSetPerSession(exerciseId: number): BestSetPerSession[] {
  try {
    const db = getDatabase();
    interface RawRow {
      workout_id: number;
      started_at: string;
      weight_kg: number;
      reps: number;
    }
    const rows = db.getAllSync<RawRow>(
      `SELECT ws.workout_id, w.started_at, ws.weight_kg, ws.reps
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE ws.exercise_id = ? AND w.finished_at IS NOT NULL
       ORDER BY w.started_at ASC, (ws.weight_kg * (1 + ws.reps / 30.0)) DESC`,
      [exerciseId]
    );
    const seen = new Set<number>();
    const result: BestSetPerSession[] = [];
    for (const row of rows) {
      if (!seen.has(row.workout_id)) {
        seen.add(row.workout_id);
        result.push({
          date: row.started_at,
          weightKg: row.weight_kg,
          reps: row.reps,
          estimated1rm: row.weight_kg * (1 + row.reps / 30),
        });
      }
    }
    return result;
  } catch (error) {
    console.error('getBestSetPerSession failed:', error);
    return [];
  }
}

export function getAllPRs(): PRWithName[] {
  try {
    const db = getDatabase();
    interface PRRow extends PRWithName {}
    return db.getAllSync<PRRow>(
      `SELECT pr.id, pr.exercise_id, pr.weight_kg, pr.reps, pr.estimated_1rm, pr.achieved_at,
              e.name as exerciseName, e.muscle_group as muscleGroup
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
       JOIN (
         SELECT exercise_id, MAX(estimated_1rm) as max_1rm
         FROM personal_records
         GROUP BY exercise_id
       ) best ON best.exercise_id = pr.exercise_id AND best.max_1rm = pr.estimated_1rm
       ORDER BY e.muscle_group, pr.estimated_1rm DESC`
    );
  } catch (error) {
    console.error('getAllPRs failed:', error);
    return [];
  }
}

export function getPRForExercise(exerciseId: number): PRWithName | null {
  try {
    const db = getDatabase();
    interface PRRow extends PRWithName {}
    return db.getFirstSync<PRRow>(
      `SELECT pr.id, pr.exercise_id, pr.weight_kg, pr.reps, pr.estimated_1rm, pr.achieved_at,
              e.name as exerciseName, e.muscle_group as muscleGroup
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
       WHERE pr.exercise_id = ?
       ORDER BY pr.estimated_1rm DESC
       LIMIT 1`,
      [exerciseId]
    );
  } catch (error) {
    console.error('getPRForExercise failed:', error);
    return null;
  }
}

export function getWeeklyVolume(weeks: number): WeeklyVolume[] {
  try {
    const db = getDatabase();
    const weekStarts: string[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekStarts.push(getWeekStart(d.toISOString()));
    }
    const weekMap = new Map<string, number>(weekStarts.map((ws) => [ws, 0]));
    const cutoff = weekStarts[0];
    interface RawRow {
      started_at: string;
      volume: number;
    }
    const rows = db.getAllSync<RawRow>(
      `SELECT w.started_at, COALESCE(SUM(ws.weight_kg * ws.reps), 0) as volume
       FROM workouts w
       LEFT JOIN workout_sets ws ON ws.workout_id = w.id
       WHERE w.finished_at IS NOT NULL AND substr(w.started_at, 1, 10) >= ?
       GROUP BY w.id`,
      [cutoff]
    );
    for (const row of rows) {
      const ws = getWeekStart(row.started_at);
      if (weekMap.has(ws)) {
        weekMap.set(ws, (weekMap.get(ws) ?? 0) + row.volume);
      }
    }
    return weekStarts.map((ws) => ({ weekStart: ws, totalVolume: weekMap.get(ws) ?? 0 }));
  } catch (error) {
    console.error('getWeeklyVolume failed:', error);
    return [];
  }
}

export function getMuscleGroupVolume(startDate: string, endDate: string): MuscleGroupVolume[] {
  try {
    const db = getDatabase();
    interface RawRow {
      muscleGroup: string;
      volume: number;
    }
    return db.getAllSync<RawRow>(
      `SELECT e.muscle_group as muscleGroup, COALESCE(SUM(ws.weight_kg * ws.reps), 0) as volume
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       JOIN exercises e ON e.id = ws.exercise_id
       WHERE w.finished_at IS NOT NULL
         AND substr(w.started_at, 1, 10) >= ?
         AND substr(w.started_at, 1, 10) <= ?
       GROUP BY e.muscle_group
       ORDER BY volume DESC`,
      [startDate, endDate]
    );
  } catch (error) {
    console.error('getMuscleGroupVolume failed:', error);
    return [];
  }
}

function getWorkoutFrequency(weeks: number): { weekStart: string; count: number }[] {
  try {
    const db = getDatabase();
    const weekStarts: string[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekStarts.push(getWeekStart(d.toISOString()));
    }
    const weekMap = new Map<string, number>(weekStarts.map((ws) => [ws, 0]));
    const cutoff = weekStarts[0];
    interface RawRow {
      started_at: string;
    }
    const rows = db.getAllSync<RawRow>(
      `SELECT started_at FROM workouts WHERE finished_at IS NOT NULL AND substr(started_at, 1, 10) >= ?`,
      [cutoff]
    );
    for (const row of rows) {
      const ws = getWeekStart(row.started_at);
      if (weekMap.has(ws)) {
        weekMap.set(ws, (weekMap.get(ws) ?? 0) + 1);
      }
    }
    return weekStarts.map((ws) => ({ weekStart: ws, count: weekMap.get(ws) ?? 0 }));
  } catch (error) {
    console.error('getWorkoutFrequency failed:', error);
    return [];
  }
}

export function getStatsOverview(): StatsOverviewData {
  try {
    const db = getDatabase();
    const thisWeekStart = getWeekStart(new Date().toISOString());
    const now = new Date();
    const thisMonthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const weekRow = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM workouts WHERE finished_at IS NOT NULL AND substr(started_at, 1, 10) >= ?`,
      [thisWeekStart]
    );
    const monthRow = db.getFirstSync<{ volume: number }>(
      `SELECT COALESCE(SUM(ws.weight_kg * ws.reps), 0) as volume
       FROM workouts w JOIN workout_sets ws ON ws.workout_id = w.id
       WHERE w.finished_at IS NOT NULL AND substr(w.started_at, 1, 10) >= ?`,
      [thisMonthStart]
    );
    const totalRow = db.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM workouts WHERE finished_at IS NOT NULL`
    );

    const freqData = getWorkoutFrequency(52).reverse(); // most recent first
    let streakWeeks = 0;
    for (const week of freqData) {
      if (week.count > 0) {
        streakWeeks++;
      } else {
        break;
      }
    }

    return {
      thisWeekCount: weekRow?.count ?? 0,
      thisMonthVolume: monthRow?.volume ?? 0,
      streakWeeks,
      totalWorkouts: totalRow?.count ?? 0,
    };
  } catch (error) {
    console.error('getStatsOverview failed:', error);
    return { thisWeekCount: 0, thisMonthVolume: 0, streakWeeks: 0, totalWorkouts: 0 };
  }
}

export function getWeekStats(): { count: number; volume: number } {
  try {
    const db = getDatabase();
    const thisWeekStart = getWeekStart(new Date().toISOString());
    const row = db.getFirstSync<{ count: number; volume: number }>(
      `SELECT COUNT(DISTINCT w.id) as count, COALESCE(SUM(ws.weight_kg * ws.reps), 0) as volume
       FROM workouts w
       LEFT JOIN workout_sets ws ON ws.workout_id = w.id
       WHERE w.finished_at IS NOT NULL AND substr(w.started_at, 1, 10) >= ?`,
      [thisWeekStart]
    );
    return { count: row?.count ?? 0, volume: row?.volume ?? 0 };
  } catch (error) {
    console.error('getWeekStats failed:', error);
    return { count: 0, volume: 0 };
  }
}
