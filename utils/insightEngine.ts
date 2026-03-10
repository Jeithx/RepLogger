import { WorkoutSummary, BodyWeightEntry, WaterDaySummary, PRWithName, WorkoutPhase } from '../types';

// ─── Data types ─────────────────────────────────────────────────────────────

export interface WorkoutSetDetail {
  workoutId: number;
  startedAt: string;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  weightKg: number;
  reps: number;
  estimated1rm: number;
}

export interface InsightData {
  workouts: WorkoutSummary[];
  workoutSets: WorkoutSetDetail[];
  bodyWeightEntries: BodyWeightEntry[];
  waterEntries: WaterDaySummary[];
  personalRecords: PRWithName[];
  currentPhase: WorkoutPhase | null;
  phaseGoalWeight: number | null;
  phaseStartDate: string | null;
  dailyWaterGoalMl: number;
  activeRoutineId: string | null;
  nextRoutineDayName: string | null;
  totalWorkoutCount: number;
}

export interface Insight {
  id: string;
  category: 'workout' | 'weight' | 'water' | 'recovery' | 'milestone';
  priority: 1 | 2 | 3;
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  generatedAt: string;
}

// ─── Daily mood ───────────────────────────────────────────────────────────────

export type DailyMood = 'happy' | 'thinking' | 'excited' | 'neutral';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseDateMs(s: string): number {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
}

function getWeekStartStr(dateMs: number): string {
  const d = new Date(dateMs);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(dateMs + diff * 86400000);
  return monday.toISOString().slice(0, 10);
}

// ─── Workout rules ────────────────────────────────────────────────────────────

function checkFirstWorkout(data: InsightData): Insight | null {
  if (data.totalWorkoutCount !== 1) return null;
  return {
    id: 'FIRST_WORKOUT',
    category: 'milestone',
    priority: 1,
    icon: '🌱',
    title: 'First Workout Logged!',
    message: 'First session logged. The hardest part is starting — you just did it.',
    generatedAt: new Date().toISOString(),
  };
}

function checkWorkoutMilestone(data: InsightData): Insight | null {
  const milestones: Record<number, string> = {
    10: "10 workouts logged. You're officially a regular.",
    25: '25 sessions. Building a real habit.',
    50: '50 sessions. Halfway to 100. Keep stacking.',
    100: '100 workouts. That\'s serious dedication.',
    200: "200 sessions. You're not the same person who started.",
  };
  const msg = milestones[data.totalWorkoutCount];
  if (!msg) return null;
  return {
    id: `MILESTONE_${data.totalWorkoutCount}`,
    category: 'milestone',
    priority: 1,
    icon: '🎯',
    title: `${data.totalWorkoutCount} Workouts!`,
    message: msg,
    generatedAt: new Date().toISOString(),
  };
}

function checkNewPR(data: InsightData): Insight | null {
  const cutoff = Date.now() - 24 * 3600000;
  const recentPR = data.personalRecords.find(
    (pr) => parseDateMs(pr.achieved_at) >= cutoff
  );
  if (!recentPR) return null;
  return {
    id: `NEW_PR_${recentPR.exercise_id}`,
    category: 'milestone',
    priority: 1,
    icon: '🏆',
    title: 'New Personal Record!',
    message: pick([
      `New PR on ${recentPR.exerciseName}! ${recentPR.weight_kg}kg × ${recentPR.reps}. Screenshot that.`,
      `${recentPR.exerciseName} PR 👏 ${recentPR.weight_kg}kg × ${recentPR.reps}. That's the good stuff.`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

function checkPlateauDetected(data: InsightData): Insight | null {
  if (data.workoutSets.length === 0) return null;

  // Build: exerciseId → array of { workoutId, date, best1rm, name }
  const sessionBest = new Map<string, { date: string; best1rm: number; name: string }>();
  for (const s of data.workoutSets) {
    const key = `${s.exerciseId}_${s.workoutId}`;
    const existing = sessionBest.get(key);
    if (!existing || s.estimated1rm > existing.best1rm) {
      sessionBest.set(key, { date: s.startedAt, best1rm: s.estimated1rm, name: s.exerciseName });
    }
  }

  const exerciseSessions = new Map<number, { date: string; best1rm: number; name: string }[]>();
  for (const [key, session] of sessionBest) {
    const exerciseId = parseInt(key.split('_')[0], 10);
    if (!exerciseSessions.has(exerciseId)) exerciseSessions.set(exerciseId, []);
    exerciseSessions.get(exerciseId)!.push(session);
  }

  for (const sessions of exerciseSessions.values()) {
    sessions.sort((a, b) => parseDateMs(a.date) - parseDateMs(b.date));
    if (sessions.length < 3) continue;
    const last3 = sessions.slice(-3);
    const first1rm = last3[0].best1rm;
    const last1rm = last3[2].best1rm;
    if (first1rm <= 0) continue;
    if ((last1rm - first1rm) / first1rm > 0.01) continue;

    const name = last3[0].name;
    return {
      id: `PLATEAU_${name.replace(/\s+/g, '_')}`,
      category: 'workout',
      priority: 1,
      icon: '🧱',
      title: 'Plateau Detected',
      message: pick([
        `You've hit a wall on ${name}. Happens to everyone. Try adding 1 extra set next time.`,
        `${name} plateau detected. Your body adapted — time to shake things up.`,
        `3 sessions, same weight on ${name}. Your muscles are bored. Let's fix that.`,
        `${name} hasn't moved in 3 sessions. Have you tried changing the rep range?`,
      ]),
      actionLabel: 'View History',
      actionRoute: '/(tabs)/history',
      generatedAt: new Date().toISOString(),
    };
  }
  return null;
}

function checkVolumeDrop(data: InsightData): Insight | null {
  if (data.workouts.length < 2) return null;
  const now = Date.now();
  const thisWeekStart = getWeekStartStr(now);
  const lastWeekStart = getWeekStartStr(now - 7 * 86400000);

  const thisVol = data.workouts
    .filter((w) => w.startedAt.slice(0, 10) >= thisWeekStart)
    .reduce((s, w) => s + w.totalVolume, 0);
  const lastVol = data.workouts
    .filter((w) => w.startedAt.slice(0, 10) >= lastWeekStart && w.startedAt.slice(0, 10) < thisWeekStart)
    .reduce((s, w) => s + w.totalVolume, 0);

  if (lastVol <= 0) return null;
  const drop = (lastVol - thisVol) / lastVol;
  if (drop <= 0.2) return null;

  const pct = Math.round(drop * 100);
  return {
    id: 'VOLUME_DROP',
    category: 'workout',
    priority: 1,
    icon: '📉',
    title: 'Volume Dropped',
    message: pick([
      `Your volume dropped ${pct}% this week. Busy week? No judgment — just get back at it.`,
      `Lighter week than usual. Recovery or life happening? Either way, you're still here.`,
    ]),
    actionRoute: '/(tabs)/history',
    generatedAt: new Date().toISOString(),
  };
}

function checkVolumeSpike(data: InsightData): Insight | null {
  if (data.workouts.length < 2) return null;
  const now = Date.now();
  const thisWeekStart = getWeekStartStr(now);
  const lastWeekStart = getWeekStartStr(now - 7 * 86400000);

  const thisVol = data.workouts
    .filter((w) => w.startedAt.slice(0, 10) >= thisWeekStart)
    .reduce((s, w) => s + w.totalVolume, 0);
  const lastVol = data.workouts
    .filter((w) => w.startedAt.slice(0, 10) >= lastWeekStart && w.startedAt.slice(0, 10) < thisWeekStart)
    .reduce((s, w) => s + w.totalVolume, 0);

  if (lastVol <= 0 || thisVol <= 0) return null;
  const spike = (thisVol - lastVol) / lastVol;
  if (spike <= 0.25) return null;

  const pct = Math.round(spike * 100);
  return {
    id: 'VOLUME_SPIKE',
    category: 'workout',
    priority: 2,
    icon: '📈',
    title: 'Volume Spike',
    message: pick([
      `Volume up ${pct}% this week. Beast mode: activated.`,
      `Big week. Just make sure you're sleeping enough to back that up.`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

function checkConsistencyStreak(data: InsightData): Insight | null {
  if (data.workouts.length < 4) return null;
  const now = Date.now();
  let streak = 0;
  for (let i = 0; i < 52; i++) {
    const weekStart = getWeekStartStr(now - i * 7 * 86400000);
    const nextWeekStart = i === 0
      ? new Date().toISOString().slice(0, 10)
      : getWeekStartStr(now - (i - 1) * 7 * 86400000);
    const hasWorkout = data.workouts.some(
      (w) => w.startedAt.slice(0, 10) >= weekStart && w.startedAt.slice(0, 10) < nextWeekStart
    );
    if (hasWorkout) streak++;
    else break;
  }
  if (streak < 4) return null;
  return {
    id: 'CONSISTENCY_STREAK',
    category: 'workout',
    priority: 1,
    icon: '🔥',
    title: 'Consistency Streak',
    message: pick([
      `4 weeks straight. That's not motivation — that's discipline.`,
      `${streak} weeks consistent. You're building something real here.`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

function checkMissedDays(data: InsightData): Insight | null {
  if (!data.activeRoutineId || data.workouts.length === 0) return null;
  const lastWorkoutMs = parseDateMs(data.workouts[0].startedAt);
  const daysSince = Math.floor((Date.now() - lastWorkoutMs) / 86400000);
  if (daysSince < 4) return null;
  return {
    id: 'MISSED_DAYS',
    category: 'recovery',
    priority: 2,
    icon: '💤',
    title: 'Time to Get Back',
    message: pick([
      `It's been ${daysSince} days since your last session. Your weights miss you.`,
      `${daysSince} days off. Rest is good, but ${data.nextRoutineDayName ?? 'your next workout'} is waiting.`,
      `${daysSince} days since your last session. What's getting in the way?`,
    ]),
    actionLabel: 'Start Workout',
    actionRoute: '/(tabs)',
    generatedAt: new Date().toISOString(),
  };
}

function checkMuscleImbalance(data: InsightData): Insight | null {
  if (data.workoutSets.length === 0) return null;
  const volumeByMuscle = new Map<string, number>();
  for (const s of data.workoutSets) {
    const mg = s.muscleGroup;
    if (mg === 'Cardio' || mg === 'Other' || mg === 'Core') continue;
    volumeByMuscle.set(mg, (volumeByMuscle.get(mg) ?? 0) + s.weightKg * s.reps);
  }
  if (volumeByMuscle.size < 2) return null;

  let dominant = '';
  let dominantVol = 0;
  let neglected = '';
  let neglectedVol = Infinity;
  for (const [mg, vol] of volumeByMuscle) {
    if (vol > dominantVol) { dominantVol = vol; dominant = mg; }
    if (vol < neglectedVol) { neglectedVol = vol; neglected = mg; }
  }
  if (dominant === neglected || neglectedVol <= 0) return null;
  if (dominantVol / neglectedVol <= 3) return null;

  return {
    id: 'MUSCLE_IMBALANCE',
    category: 'workout',
    priority: 2,
    icon: '⚖️',
    title: 'Muscle Imbalance',
    message: pick([
      `You've been hammering ${dominant}. ${neglected} is feeling left out.`,
      `Balanced training = better results. ${neglected} could use some love.`,
      `When did you last program ${neglected} training specifically?`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Body weight rules ────────────────────────────────────────────────────────

function checkGoalReached(data: InsightData): Insight | null {
  if (!data.phaseGoalWeight || data.bodyWeightEntries.length === 0) return null;
  const current = data.bodyWeightEntries[0].weight_kg;
  if (Math.abs(current - data.phaseGoalWeight) > 0.5) return null;
  return {
    id: 'GOAL_REACHED',
    category: 'milestone',
    priority: 1,
    icon: '🏁',
    title: 'Goal Reached!',
    message: pick([
      `You hit your goal weight. Seriously — take a moment to appreciate that.`,
      `Goal reached. Now what? Set a new one.`,
    ]),
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkCloseToGoal(data: InsightData): Insight | null {
  if (!data.phaseGoalWeight || data.bodyWeightEntries.length === 0) return null;
  const current = data.bodyWeightEntries[0].weight_kg;
  const diff = Math.abs(current - data.phaseGoalWeight);
  if (diff <= 0.5 || diff > 2) return null;
  return {
    id: 'CLOSE_TO_GOAL',
    category: 'weight',
    priority: 1,
    icon: '🎯',
    title: 'Almost There',
    message: pick([
      `Only ${diff.toFixed(1)}kg away from your goal. You can almost taste it.`,
      `${diff.toFixed(1)}kg to go. The finish line is right there.`,
    ]),
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkWeightTrendCut(data: InsightData): Insight | null {
  if (data.currentPhase !== 'cut' || data.bodyWeightEntries.length < 4) return null;
  const cutoff = Date.now() - 14 * 86400000;
  const last14 = [...data.bodyWeightEntries]
    .sort((a, b) => parseDateMs(a.recorded_at) - parseDateMs(b.recorded_at))
    .filter((e) => parseDateMs(e.recorded_at) >= cutoff);
  if (last14.length < 2) return null;

  const half = Math.floor(last14.length / 2);
  const firstAvg = last14.slice(0, half).reduce((s, e) => s + e.weight_kg, 0) / half;
  const lastHalf = last14.slice(half);
  const lastAvg = lastHalf.reduce((s, e) => s + e.weight_kg, 0) / lastHalf.length;
  if (lastAvg >= firstAvg - 0.3) return null;

  const diff = (firstAvg - lastAvg).toFixed(1);
  return {
    id: 'WEIGHT_TREND_CUT',
    category: 'weight',
    priority: 1,
    icon: '📉',
    title: 'Cut is Working',
    message: pick([
      `Scale's moving in the right direction. Down ${diff}kg in 2 weeks.`,
      `Cut is working. ${diff}kg down from 2 weeks ago.`,
    ]),
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkWeightTrendCutStall(data: InsightData): Insight | null {
  if (data.currentPhase !== 'cut' || data.bodyWeightEntries.length < 4) return null;
  const cutoff = Date.now() - 14 * 86400000;
  const last14 = [...data.bodyWeightEntries]
    .sort((a, b) => parseDateMs(a.recorded_at) - parseDateMs(b.recorded_at))
    .filter((e) => parseDateMs(e.recorded_at) >= cutoff);
  if (last14.length < 2) return null;

  const half = Math.floor(last14.length / 2);
  const firstAvg = last14.slice(0, half).reduce((s, e) => s + e.weight_kg, 0) / half;
  const lastHalf = last14.slice(half);
  const lastAvg = lastHalf.reduce((s, e) => s + e.weight_kg, 0) / lastHalf.length;
  if (Math.abs(firstAvg - lastAvg) > 0.3) return null;

  return {
    id: 'WEIGHT_TREND_CUT_STALL',
    category: 'weight',
    priority: 1,
    icon: '🔍',
    title: 'Cut Stalled',
    message: pick([
      `Scale stalled for 2 weeks. Might be time to review your deficit.`,
      `Weight holding steady on cut. Water retention or diet drift — worth checking.`,
    ]),
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkWeightTrendBulk(data: InsightData): Insight | null {
  if (data.currentPhase !== 'bulk' || data.bodyWeightEntries.length < 4) return null;
  const sorted = [...data.bodyWeightEntries].sort(
    (a, b) => parseDateMs(a.recorded_at) - parseDateMs(b.recorded_at)
  );

  let phaseStartKg: number | null = null;
  if (data.phaseStartDate) {
    const startMs = parseDateMs(data.phaseStartDate);
    const phaseEntries = sorted.filter((e) => parseDateMs(e.recorded_at) >= startMs);
    if (phaseEntries.length > 0) phaseStartKg = phaseEntries[0].weight_kg;
  }
  if (phaseStartKg === null) phaseStartKg = sorted[0].weight_kg;

  const current = sorted[sorted.length - 1].weight_kg;
  if (current <= phaseStartKg) return null;

  const diff = (current - phaseStartKg).toFixed(1);
  return {
    id: 'WEIGHT_TREND_BULK',
    category: 'weight',
    priority: 1,
    icon: '📈',
    title: 'Bulk On Track',
    message: pick([
      `Bulk is on track. Up ${diff}kg since phase start.`,
      `Gaining steadily. Just make sure the lifts are going up too.`,
    ]),
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkNoWeightLogged(data: InsightData): Insight | null {
  if (data.bodyWeightEntries.length === 0) return null;
  const lastMs = parseDateMs(data.bodyWeightEntries[0].recorded_at);
  const daysSince = Math.floor((Date.now() - lastMs) / 86400000);
  if (daysSince < 3) return null;
  return {
    id: 'NO_WEIGHT_LOGGED',
    category: 'weight',
    priority: 2,
    icon: '⚖️',
    title: 'Log Your Weight',
    message: pick([
      `Haven't seen a weigh-in in ${daysSince} days. Consistency in tracking = better data.`,
      `Scale's been quiet. Log your weight to keep the trend accurate.`,
    ]),
    actionLabel: 'Log Now',
    actionRoute: '/bodyweight',
    generatedAt: new Date().toISOString(),
  };
}

function checkDailyVariance(data: InsightData): Insight | null {
  if (data.bodyWeightEntries.length < 4) return null;
  const sorted = [...data.bodyWeightEntries].sort(
    (a, b) => parseDateMs(b.recorded_at) - parseDateMs(a.recorded_at)
  );
  const today = sorted[0];
  if (today.recorded_at.slice(0, 10) !== new Date().toISOString().slice(0, 10)) return null;

  const last7 = sorted.filter((e) => parseDateMs(e.recorded_at) >= Date.now() - 7 * 86400000);
  if (last7.length < 3) return null;

  const avg = last7.reduce((s, e) => s + e.weight_kg, 0) / last7.length;
  const diff = today.weight_kg - avg;
  if (Math.abs(diff) <= 1.5) return null;

  const absDiff = Math.abs(diff).toFixed(1);
  return {
    id: 'DAILY_VARIANCE',
    category: 'weight',
    priority: 3,
    icon: '💧',
    title: 'Daily Fluctuation',
    message: diff > 0
      ? `You're ${absDiff}kg above your 7-day average today. Probably water weight — don't panic.`
      : `Big drop today (${absDiff}kg below avg). Likely water. Trend matters more than daily swings.`,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Water rules ──────────────────────────────────────────────────────────────

function checkHydrationGreat(data: InsightData): Insight | null {
  if (data.waterEntries.length < 7) return null;
  const last7 = [...data.waterEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const daysHit = last7.filter((d) => d.totalMl >= data.dailyWaterGoalMl).length;
  if (daysHit < 5) return null;
  return {
    id: 'HYDRATION_GREAT',
    category: 'water',
    priority: 2,
    icon: '💧',
    title: 'Great Hydration',
    message: pick([
      `Solid hydration week. ${daysHit}/7 days hitting your goal.`,
      `Your kidneys are very happy with you right now.`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

function checkHydrationPoor(data: InsightData): Insight | null {
  if (data.waterEntries.length < 7) return null;
  const last7 = [...data.waterEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const daysHit = last7.filter((d) => d.totalMl >= data.dailyWaterGoalMl).length;
  if (daysHit > 2) return null;
  return {
    id: 'HYDRATION_POOR',
    category: 'water',
    priority: 1,
    icon: '🏜️',
    title: 'Hydration Low',
    message: pick([
      `Hydration's been off this week. Even 500ml more per day makes a difference.`,
      `Low water intake this week. Dehydration tanks performance — worth fixing.`,
    ]),
    actionLabel: 'Log Water',
    actionRoute: '/water',
    generatedAt: new Date().toISOString(),
  };
}

function checkHydrationTodayBehind(data: InsightData): Insight | null {
  const hour = new Date().getHours();
  if (hour < 14) return null;
  const todayDate = new Date().toISOString().slice(0, 10);
  const sorted = [...data.waterEntries].sort((a, b) => b.date.localeCompare(a.date));
  const todayEntry = sorted[0];
  const todayMl = todayEntry?.date === todayDate ? todayEntry.totalMl : 0;
  if (todayMl >= data.dailyWaterGoalMl * 0.4) return null;

  const remaining = data.dailyWaterGoalMl - todayMl;
  return {
    id: 'HYDRATION_TODAY_BEHIND',
    category: 'water',
    priority: 2,
    icon: '⏰',
    title: 'Behind on Water',
    message: pick([
      `It's ${hour}:00 and you're at ${todayMl}ml. Drink a big glass right now.`,
      `Behind on water today. ${remaining}ml to go before end of day.`,
    ]),
    actionLabel: 'Log Water',
    actionRoute: '/water',
    generatedAt: new Date().toISOString(),
  };
}

function checkWaterStreak(data: InsightData): Insight | null {
  const sorted = [...data.waterEntries].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const entry of sorted) {
    if (entry.totalMl >= data.dailyWaterGoalMl) streak++;
    else break;
  }
  if (streak < 7) return null;
  return {
    id: 'WATER_STREAK',
    category: 'water',
    priority: 2,
    icon: '🌊',
    title: 'Hydration Streak',
    message: `${streak} days hitting your water goal. Hydration habit: locked in.`,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Recovery rules ───────────────────────────────────────────────────────────

function checkOvertrainingRisk(data: InsightData): Insight | null {
  if (data.workouts.length < 6) return null;
  const sorted = [...data.workouts].sort((a, b) => parseDateMs(b.startedAt) - parseDateMs(a.startedAt));
  let consecutive = 1;
  for (let i = 1; i < Math.min(sorted.length, 10); i++) {
    const prevDate = sorted[i - 1].startedAt.slice(0, 10) + 'T00:00:00Z';
    const currDate = sorted[i].startedAt.slice(0, 10) + 'T00:00:00Z';
    const gap = parseDateMs(prevDate) - parseDateMs(currDate);
    if (gap <= 86400000 && gap >= 0) consecutive++;
    else break;
  }
  if (consecutive < 6) return null;
  return {
    id: 'OVERTRAINING_RISK',
    category: 'recovery',
    priority: 1,
    icon: '😮',
    title: 'Rest Day Needed',
    message: pick([
      `6 days straight. Your body needs at least one full rest day to actually grow.`,
      `No rest days this week. Overtraining is real — take tomorrow off.`,
    ]),
    generatedAt: new Date().toISOString(),
  };
}

function checkOptimalFrequency(data: InsightData): Insight | null {
  const now = Date.now();
  const weekStart = getWeekStartStr(now);
  const weekWorkouts = data.workouts.filter((w) => w.startedAt.slice(0, 10) >= weekStart);
  if (weekWorkouts.length < 3 || weekWorkouts.length > 5) return null;

  const sorted = [...data.workouts].sort((a, b) => parseDateMs(b.startedAt) - parseDateMs(a.startedAt));
  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevMs = parseDateMs(sorted[i - 1].startedAt.slice(0, 10) + 'T00:00:00Z');
    const currMs = parseDateMs(sorted[i].startedAt.slice(0, 10) + 'T00:00:00Z');
    if (prevMs - currMs <= 86400000) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }
  if (maxConsecutive > 4) return null;
  return {
    id: 'OPTIMAL_FREQUENCY',
    category: 'recovery',
    priority: 3,
    icon: '✅',
    title: 'Great Training Frequency',
    message: `Solid training frequency this week. That's the sweet spot.`,
    generatedAt: new Date().toISOString(),
  };
}

function checkLongSession(data: InsightData): Insight | null {
  if (data.workouts.length === 0) return null;
  const last = data.workouts[0];
  if (last.durationSeconds <= 90 * 60) return null;
  const mins = Math.round(last.durationSeconds / 60);
  return {
    id: 'LONG_SESSION',
    category: 'recovery',
    priority: 3,
    icon: '⏱️',
    title: 'Long Session',
    message: `That was a long one (${mins} min). Make sure you're eating enough to recover.`,
    generatedAt: new Date().toISOString(),
  };
}

function checkShortRest(data: InsightData): Insight | null {
  if (data.workouts.length < 2) return null;
  const sorted = [...data.workouts].sort((a, b) => parseDateMs(b.startedAt) - parseDateMs(a.startedAt));
  const gap = parseDateMs(sorted[0].startedAt) - parseDateMs(sorted[1].startedAt);
  if (gap >= 16 * 3600000) return null;
  return {
    id: 'SHORT_REST',
    category: 'recovery',
    priority: 2,
    icon: '⚡',
    title: 'Back-to-Back Sessions',
    message: `Back-to-back sessions with barely any rest. Hope you're feeling it in a good way.`,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function generateInsights(data: InsightData): Insight[] {
  const results: Insight[] = [];
  const tryAdd = (fn: () => Insight | null) => {
    try {
      const insight = fn();
      if (insight) results.push(insight);
    } catch {
      // Skip silently — never crash home screen
    }
  };

  // Milestone rules (highest priority)
  tryAdd(() => checkFirstWorkout(data));
  tryAdd(() => checkWorkoutMilestone(data));
  tryAdd(() => checkNewPR(data));
  tryAdd(() => checkGoalReached(data));

  // Workout rules
  tryAdd(() => checkPlateauDetected(data));
  tryAdd(() => checkVolumeDrop(data));
  tryAdd(() => checkVolumeSpike(data));
  tryAdd(() => checkConsistencyStreak(data));
  tryAdd(() => checkMissedDays(data));
  tryAdd(() => checkMuscleImbalance(data));

  // Body weight rules
  tryAdd(() => checkCloseToGoal(data));
  tryAdd(() => checkWeightTrendCut(data));
  tryAdd(() => checkWeightTrendCutStall(data));
  tryAdd(() => checkWeightTrendBulk(data));
  tryAdd(() => checkNoWeightLogged(data));
  tryAdd(() => checkDailyVariance(data));

  // Water rules
  tryAdd(() => checkHydrationPoor(data));
  tryAdd(() => checkHydrationGreat(data));
  tryAdd(() => checkHydrationTodayBehind(data));
  tryAdd(() => checkWaterStreak(data));

  // Recovery rules
  tryAdd(() => checkOvertrainingRisk(data));
  tryAdd(() => checkShortRest(data));
  tryAdd(() => checkOptimalFrequency(data));
  tryAdd(() => checkLongSession(data));

  return results;
}

// ─── Default insights (rotate daily) ─────────────────────────────────────────

const DEFAULT_POOL: Omit<Insight, 'generatedAt'>[] = [
  {
    id: 'DEFAULT',
    category: 'workout',
    priority: 3,
    icon: '💪',
    title: 'Keep Going',
    message: 'Everything looks good. Show up today and keep the streak going.',
  },
  {
    id: 'DEFAULT',
    category: 'workout',
    priority: 3,
    icon: '🤔',
    title: 'One Goal Today',
    message: "What's one lift you want to improve this week? Make that your focus.",
  },
  {
    id: 'DEFAULT',
    category: 'workout',
    priority: 3,
    icon: '🌅',
    title: 'Progress Takes Time',
    message: "Look back at where you started. Every session compounds — you're building something real.",
  },
];

export function getDailyDefault(): Insight {
  const dayIndex = Math.floor(Date.now() / 86400000) % DEFAULT_POOL.length;
  return { ...DEFAULT_POOL[dayIndex], generatedAt: new Date().toISOString() };
}

// Static export for backward compatibility
export const DEFAULT_INSIGHT: Insight = {
  ...DEFAULT_POOL[0],
  generatedAt: new Date().toISOString(),
};

export function selectDailyInsights(
  allInsights: Insight[],
  dismissedIds: string[],
  recentIds: string[]
): Insight[] {
  const fallback = getDailyDefault();
  if (allInsights.length === 0) return [fallback];

  const filtered = allInsights.filter(
    (i) => !dismissedIds.includes(i.id) && !recentIds.includes(i.id)
  );
  if (filtered.length === 0) return [fallback];

  const p1 = filtered.filter((i) => i.priority === 1);
  const p2 = filtered.filter((i) => i.priority === 2);
  const p3 = filtered.filter((i) => i.priority === 3);

  const selected: Insight[] = [];
  for (let i = 0; i < Math.min(2, p1.length) && selected.length < 3; i++) {
    selected.push(p1[i]);
  }
  for (const f of [...p2, ...p3]) {
    if (selected.length >= 3) break;
    selected.push(f);
  }

  return selected.length > 0 ? selected : [fallback];
}

// ─── Daily mood computation ───────────────────────────────────────────────────

export function computeDailyMood(data: InsightData): DailyMood {
  const now = Date.now();

  // Recent PR in last 24h → excited
  const recentPR = data.personalRecords.find(
    (pr) => parseDateMs(pr.achieved_at) >= now - 24 * 3600000
  );
  if (recentPR) return 'excited';

  // Milestone workout count → excited
  const milestones = [1, 10, 25, 50, 100, 200];
  if (milestones.includes(data.totalWorkoutCount)) return 'excited';

  // Goal weight reached → excited
  if (
    data.phaseGoalWeight &&
    data.bodyWeightEntries.length > 0 &&
    Math.abs(data.bodyWeightEntries[0].weight_kg - data.phaseGoalWeight) <= 0.5
  ) return 'excited';

  // Too many missed days → thinking
  if (data.activeRoutineId && data.workouts.length > 0) {
    const daysSince = Math.floor((now - parseDateMs(data.workouts[0].startedAt)) / 86400000);
    if (daysSince >= 4) return 'thinking';
  }

  // Great hydration week → happy
  if (data.waterEntries.length >= 7) {
    const last7 = [...data.waterEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const daysHit = last7.filter((d) => d.totalMl >= data.dailyWaterGoalMl).length;
    if (daysHit >= 5) return 'happy';
  }

  // Consistency streak (4+ weeks) → happy
  if (data.workouts.length >= 4) {
    let streak = 0;
    for (let i = 0; i < 4; i++) {
      const weekStart = getWeekStartStr(now - i * 7 * 86400000);
      const nextWeekStart =
        i === 0
          ? new Date(now).toISOString().slice(0, 10)
          : getWeekStartStr(now - (i - 1) * 7 * 86400000);
      const has = data.workouts.some(
        (w) => w.startedAt.slice(0, 10) >= weekStart && w.startedAt.slice(0, 10) < nextWeekStart
      );
      if (has) streak++;
      else break;
    }
    if (streak >= 4) return 'happy';
  }

  // Default: rotate daily so mood is consistent within the same day
  const dayOfYear = Math.floor(now / 86400000);
  const defaults: DailyMood[] = ['neutral', 'happy', 'neutral', 'thinking'];
  return defaults[dayOfYear % defaults.length];
}
