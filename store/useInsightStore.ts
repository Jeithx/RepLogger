import { create } from 'zustand';
import { getDatabase } from '../db/database';
import { getSetting, setSetting } from '../db/settingsQueries';
import { getWorkoutHistory } from '../db/historyQueries';
import { getBodyWeightEntries } from '../db/bodyWeightQueries';
import { getWaterHistory } from '../db/waterQueries';
import { getAllPRs } from '../db/historyQueries';
import {
  Insight,
  InsightData,
  WorkoutSetDetail,
  generateInsights,
  selectDailyInsights,
  DEFAULT_INSIGHT,
} from '../utils/insightEngine';
import { WorkoutPhase } from '../types';

interface InsightStore {
  insights: Insight[];
  isLoading: boolean;
  lastGeneratedAt: string | null;

  generateAndLoad: () => void;
  dismissInsight: (id: string) => void;
  refreshInsights: () => void;
}

function queryWorkoutSets(workoutIds: number[]): WorkoutSetDetail[] {
  if (workoutIds.length === 0) return [];
  try {
    const db = getDatabase();
    const placeholders = workoutIds.map(() => '?').join(',');
    interface RawRow {
      workoutId: number;
      startedAt: string;
      exerciseId: number;
      exerciseName: string;
      muscleGroup: string;
      weightKg: number;
      reps: number;
      estimated1rm: number;
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
  } catch {
    return [];
  }
}

function getTotalWorkoutCount(): number {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM workouts WHERE finished_at IS NOT NULL'
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
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
  } catch {
    return null;
  }
}

function getDismissedIds(): string[] {
  try {
    const raw = getSetting('rex_dismissed_insights');
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function getRecentMap(): Record<string, number> {
  try {
    const raw = getSetting('rex_recent_insights');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function cleanRecentMap(map: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - 3 * 86400000;
  const cleaned: Record<string, number> = {};
  for (const [id, ts] of Object.entries(map)) {
    if (ts > cutoff) cleaned[id] = ts;
  }
  return cleaned;
}

export const useInsightStore = create<InsightStore>((set, get) => ({
  insights: [],
  isLoading: false,
  lastGeneratedAt: null,

  generateAndLoad: () => {
    set({ isLoading: true });
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
          ? currentPhaseStr
          : null;
      const phaseGoalWeightStr = getSetting('phase_goal_weight');
      const phaseGoalWeight = phaseGoalWeightStr ? parseFloat(phaseGoalWeightStr) : null;
      const phaseStartDate = getSetting('phase_start_date') || null;
      const dailyWaterGoalMl = parseInt(getSetting('daily_water_goal_ml') || '2500', 10);
      const activeRoutineId = getSetting('active_routine_id') || null;

      const dismissedIds = getDismissedIds();
      const recentMap = cleanRecentMap(getRecentMap());
      const recentIds = Object.keys(recentMap);

      const insightData: InsightData = {
        workouts,
        workoutSets,
        bodyWeightEntries,
        waterEntries,
        personalRecords,
        currentPhase,
        phaseGoalWeight,
        phaseStartDate,
        dailyWaterGoalMl,
        activeRoutineId,
        nextRoutineDayName,
        totalWorkoutCount,
      };

      const allInsights = generateInsights(insightData);
      const selected = selectDailyInsights(allInsights, dismissedIds, recentIds);

      // Track recently shown
      const newRecentMap = { ...recentMap };
      for (const insight of selected) {
        if (insight.id !== 'DEFAULT') newRecentMap[insight.id] = Date.now();
      }
      setSetting('rex_recent_insights', JSON.stringify(newRecentMap));

      set({ insights: selected, isLoading: false, lastGeneratedAt: new Date().toISOString() });
    } catch {
      set({ insights: [DEFAULT_INSIGHT], isLoading: false });
    }
  },

  dismissInsight: (id: string) => {
    // Add to permanent dismissed list
    const dismissed = getDismissedIds();
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      setSetting('rex_dismissed_insights', JSON.stringify(dismissed));
    }
    set((state) => ({ insights: state.insights.filter((i) => i.id !== id) }));

    // If empty after dismiss, regenerate silently
    if (get().insights.length === 0) {
      get().generateAndLoad();
    }
  },

  refreshInsights: () => {
    // Clear recent tracking so all eligible insights can show
    setSetting('rex_recent_insights', '{}');
    get().generateAndLoad();
  },
}));
