import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getDatabase } from '../db/database';
import { getWeekStats } from '../db/historyQueries';
import { getTodaysTotalMl } from '../db/waterQueries';
import { getSetting } from '../db/settingsQueries';
import {
  generateInsights,
  DEFAULT_INSIGHT,
  InsightData,
  WorkoutSetDetail,
} from '../utils/insightEngine';
import { getWorkoutHistory, getAllPRs } from '../db/historyQueries';
import { getBodyWeightEntries } from '../db/bodyWeightQueries';
import { getWaterHistory } from '../db/waterQueries';
import { WorkoutPhase } from '../types';
import type {} from './RexSmallWidget'; // WidgetData type only
import { RexWideWidget } from './RexWideWidget';

// ── Data helpers ─────────────────────────────────────────────────────────────

function queryWorkoutSets(workoutIds: number[]): WorkoutSetDetail[] {
  if (workoutIds.length === 0) return [];
  try {
    const db = getDatabase();
    const placeholders = workoutIds.map(() => '?').join(',');
    interface RawRow {
      workoutId: number; startedAt: string; exerciseId: number;
      exerciseName: string; muscleGroup: string;
      weightKg: number; reps: number; estimated1rm: number;
    }
    return db.getAllSync<RawRow>(
      `SELECT ws.workout_id as workoutId, w.started_at as startedAt,
              ws.exercise_id as exerciseId, e.name as exerciseName,
              e.muscle_group as muscleGroup,
              ws.weight_kg as weightKg, ws.reps,
              ws.weight_kg * (1 + ws.reps / 30.0) as estimated1rm
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       JOIN exercises e ON e.id = ws.exercise_id
       WHERE ws.workout_id IN (${placeholders})`,
      workoutIds
    );
  } catch { return []; }
}

function getTotalWorkoutCount(): number {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM workouts WHERE finished_at IS NOT NULL'
    );
    return row?.count ?? 0;
  } catch { return 0; }
}

function getNextRoutineDayName(): string | null {
  try {
    const db = getDatabase();
    const lastUsedId = getSetting('last_used_routine_day_id');
    if (!lastUsedId) return null;
    const activeRoutineId = getSetting('active_routine_id');
    if (!activeRoutineId) return null;
    interface DayRow { id: number; day_order: number; name: string }
    const days = db.getAllSync<DayRow>(
      `SELECT id, day_order, name FROM routine_days WHERE routine_id = ? ORDER BY day_order`,
      [activeRoutineId]
    );
    if (days.length === 0) return null;
    const currentIdx = days.findIndex((d) => d.id === parseInt(lastUsedId, 10));
    const nextIdx = (currentIdx + 1) % days.length;
    return days[nextIdx]?.name ?? null;
  } catch { return null; }
}

// ── Main data fetch ───────────────────────────────────────────────────────────

function fetchWidgetData() {
  try {
    const workouts = getWorkoutHistory(30, 0);
    const workoutIds = workouts.map((w) => w.id);
    const workoutSets = queryWorkoutSets(workoutIds);
    const bodyWeightEntries = getBodyWeightEntries(30, 0);
    const waterEntries = getWaterHistory(14, 0);
    const personalRecords = getAllPRs();
    const totalWorkoutCount = getTotalWorkoutCount();
    const nextRoutineDayName = getNextRoutineDayName();

    const currentPhaseStr = getSetting('current_phase');
    const currentPhase: WorkoutPhase | null =
      currentPhaseStr === 'cut' || currentPhaseStr === 'bulk' || currentPhaseStr === 'maintain'
        ? currentPhaseStr : null;
    const phaseGoalWeightStr = getSetting('phase_goal_weight');
    const phaseGoalWeight = phaseGoalWeightStr ? parseFloat(phaseGoalWeightStr) : null;
    const phaseStartDate = getSetting('phase_start_date') || null;
    const dailyWaterGoalMl = parseInt(getSetting('daily_water_goal_ml') || '2500', 10);
    const activeRoutineId = getSetting('active_routine_id') || null;

    const insightData: InsightData = {
      workouts, workoutSets, bodyWeightEntries, waterEntries, personalRecords,
      currentPhase, phaseGoalWeight, phaseStartDate, dailyWaterGoalMl,
      activeRoutineId, nextRoutineDayName, totalWorkoutCount,
    };

    const allInsights = generateInsights(insightData);
    const topInsight = allInsights.length > 0 ? allInsights[0] : DEFAULT_INSIGHT;
    const weekStats = getWeekStats();
    const todayMl = getTodaysTotalMl();
    const waterPct = dailyWaterGoalMl > 0
      ? Math.min(100, Math.round((todayMl / dailyWaterGoalMl) * 100))
      : 0;

    return { topInsight, weekStats, waterPct };
  } catch {
    return { topInsight: DEFAULT_INSIGHT, weekStats: { count: 0, volume: 0 }, waterPct: 0 };
  }
}

// ── Task handler ──────────────────────────────────────────────────────────────

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const { topInsight, weekStats, waterPct } = fetchWidgetData();

      if (widgetInfo.widgetName === 'RexWideWidget') {
        renderWidget(
          React.createElement(RexWideWidget, {
            insightIcon: topInsight.icon,
            insightTitle: topInsight.title,
            insightCategory: topInsight.category,
            weekCount: weekStats.count,
            weekVolumeKg: weekStats.volume,
            waterPct,
          })
        );
      }
      break;
    }

    case 'WIDGET_DELETED':
    default:
      break;
  }
}
