import {
  generateInsights,
  selectDailyInsights,
  getDailyDefault,
  computeDailyMood,
  DEFAULT_INSIGHT,
  DailyMood,
  InsightData,
  Insight,
} from '../insightEngine';

// ─── Factories ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}


function makeData(overrides: Partial<InsightData> = {}): InsightData {
  return {
    workouts: [],
    workoutSets: [],
    bodyWeightEntries: [],
    waterEntries: [],
    personalRecords: [],
    currentPhase: null,
    phaseGoalWeight: null,
    phaseStartDate: null,
    dailyWaterGoalMl: 2500,
    activeRoutineId: null,
    nextRoutineDayName: null,
    totalWorkoutCount: 0,
    ...overrides,
  };
}

function makeWorkout(daysBack: number, totalVolume = 1000, durationSeconds = 3600) {
  return {
    id: daysBack,
    startedAt: daysAgo(daysBack),
    finishedAt: daysAgo(daysBack),
    totalVolume,
    durationSeconds,
    exerciseCount: 3,
    routineDayName: null,
    exerciseNames: '',
  };
}

function makeWaterEntry(daysBack: number, totalMl: number) {
  const d = new Date(Date.now() - daysBack * 86400000);
  return {
    date: d.toISOString().slice(0, 10),
    totalMl,
  };
}

function makeBwEntry(daysBack: number, weightKg: number) {
  return {
    id: daysBack,
    weight_kg: weightKg,
    recorded_at: daysAgo(daysBack),
    notes: null,
  };
}

function makePR(exerciseId: number, hoursBack: number, weightKg = 100, reps = 5) {
  return {
    id: exerciseId,
    exercise_id: exerciseId,
    exerciseName: `Exercise${exerciseId}`,
    muscleGroup: 'Chest',
    weight_kg: weightKg,
    reps,
    achieved_at: new Date(Date.now() - hoursBack * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    estimated_1rm: weightKg * (1 + reps / 30),
  };
}

// ─── getDailyDefault ──────────────────────────────────────────────────────────

describe('getDailyDefault', () => {
  it('returns a valid Insight with id DEFAULT', () => {
    const insight = getDailyDefault();
    expect(insight.id).toBe('DEFAULT');
    expect(insight.priority).toBe(3);
    expect(insight.category).toBe('workout');
    expect(typeof insight.title).toBe('string');
    expect(typeof insight.message).toBe('string');
    expect(typeof insight.generatedAt).toBe('string');
  });

  it('returns consistently for the same day', () => {
    const a = getDailyDefault();
    const b = getDailyDefault();
    expect(a.title).toBe(b.title);
  });

  it('DEFAULT_INSIGHT is a valid static export', () => {
    expect(DEFAULT_INSIGHT.id).toBe('DEFAULT');
    expect(DEFAULT_INSIGHT.priority).toBe(3);
  });
});

// ─── selectDailyInsights ──────────────────────────────────────────────────────

function makeInsight(id: string, priority: 1 | 2 | 3 = 2): Insight {
  return {
    id,
    category: 'workout',
    priority,
    icon: '💪',
    title: id,
    message: `msg for ${id}`,
    generatedAt: new Date().toISOString(),
  };
}

describe('selectDailyInsights', () => {
  it('returns daily default when allInsights is empty', () => {
    const result = selectDailyInsights([], [], []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('DEFAULT');
  });

  it('filters out recentIds and returns others', () => {
    const insights = [makeInsight('A', 1), makeInsight('B', 2), makeInsight('C', 3)];
    const result = selectDailyInsights(insights, [], ['A']);
    expect(result.map((i) => i.id)).not.toContain('A');
    expect(result.map((i) => i.id)).toContain('B');
  });

  it('filters out dismissedIds', () => {
    const insights = [makeInsight('A', 1), makeInsight('B', 2)];
    const result = selectDailyInsights(insights, ['A'], []);
    expect(result.map((i) => i.id)).not.toContain('A');
  });

  it('returns daily default when all insights are filtered out', () => {
    const insights = [makeInsight('A', 1)];
    const result = selectDailyInsights(insights, ['A'], []);
    expect(result[0].id).toBe('DEFAULT');
  });

  it('prioritizes p1 insights over p2 and p3', () => {
    const insights = [
      makeInsight('LOW', 3),
      makeInsight('MED', 2),
      makeInsight('HIGH', 1),
    ];
    const result = selectDailyInsights(insights, [], []);
    expect(result[0].id).toBe('HIGH');
  });

  it('returns at most 3 insights', () => {
    const insights = Array.from({ length: 10 }, (_, i) => makeInsight(`INS_${i}`, 2));
    const result = selectDailyInsights(insights, [], []);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('returns up to 2 p1 insights then fills with p2/p3', () => {
    const p1a = makeInsight('P1A', 1);
    const p1b = makeInsight('P1B', 1);
    const p1c = makeInsight('P1C', 1);
    const p2 = makeInsight('P2', 2);
    const result = selectDailyInsights([p1a, p1b, p1c, p2], [], []);
    const ids = result.map((i) => i.id);
    expect(ids).toContain('P1A');
    expect(ids).toContain('P1B');
    // 3rd slot filled by p2 since max 2 p1 then fills
    expect(ids).toContain('P2');
    expect(ids).not.toContain('P1C');
  });
});

// ─── generateInsights — milestone rules ──────────────────────────────────────

describe('generateInsights: checkFirstWorkout', () => {
  it('fires on totalWorkoutCount === 1', () => {
    const data = makeData({ totalWorkoutCount: 1 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'FIRST_WORKOUT')).toBe(true);
  });

  it('does not fire on count > 1', () => {
    const data = makeData({ totalWorkoutCount: 2 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'FIRST_WORKOUT')).toBe(false);
  });
});

describe('generateInsights: checkWorkoutMilestone', () => {
  it('fires on milestone counts', () => {
    for (const count of [10, 25, 50, 100, 200]) {
      const data = makeData({ totalWorkoutCount: count });
      const result = generateInsights(data);
      expect(result.some((i) => i.id === `MILESTONE_${count}`)).toBe(true);
    }
  });

  it('does not fire on non-milestone counts', () => {
    const data = makeData({ totalWorkoutCount: 15 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id.startsWith('MILESTONE_'))).toBe(false);
  });
});

describe('generateInsights: checkNewPR', () => {
  it('fires when PR achieved in last 24h', () => {
    const data = makeData({ personalRecords: [makePR(1, 2)] }); // 2 hours ago
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'NEW_PR_1')).toBe(true);
  });

  it('does not fire when PR is older than 24h', () => {
    const data = makeData({ personalRecords: [makePR(1, 30)] }); // 30 hours ago
    const result = generateInsights(data);
    expect(result.some((i) => i.id.startsWith('NEW_PR_'))).toBe(false);
  });
});

// ─── generateInsights — workout rules ────────────────────────────────────────

describe('generateInsights: checkMissedDays', () => {
  it('fires when 4+ days since last workout with active routine', () => {
    const data = makeData({
      activeRoutineId: '1',
      workouts: [makeWorkout(5)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'MISSED_DAYS')).toBe(true);
  });

  it('does not fire without active routine', () => {
    const data = makeData({ workouts: [makeWorkout(5)] });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'MISSED_DAYS')).toBe(false);
  });

  it('does not fire when last workout was recent', () => {
    const data = makeData({
      activeRoutineId: '1',
      workouts: [makeWorkout(2)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'MISSED_DAYS')).toBe(false);
  });

  it('message contains daysSince count', () => {
    const data = makeData({
      activeRoutineId: '1',
      workouts: [makeWorkout(6)],
    });
    const result = generateInsights(data);
    const insight = result.find((i) => i.id === 'MISSED_DAYS');
    expect(insight).toBeDefined();
    expect(insight!.message).toMatch(/6/);
  });
});

describe('generateInsights: checkVolumeDrop', () => {
  function makeThisWeekWorkout(volume: number) {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getTime() + diff * 86400000);
    return {
      id: Math.random(),
      startedAt: monday.toISOString().slice(0, 10) + ' 10:00:00',
      finishedAt: monday.toISOString().slice(0, 10) + ' 11:00:00',
      totalVolume: volume,
      durationSeconds: 3600,
      exerciseCount: 3,
      routineDayName: null,
      exerciseNames: '',
    };
  }

  function makeLastWeekWorkout(volume: number) {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const lastMonday = new Date(now.getTime() + diff * 86400000 - 7 * 86400000);
    return {
      id: Math.random(),
      startedAt: lastMonday.toISOString().slice(0, 10) + ' 10:00:00',
      finishedAt: lastMonday.toISOString().slice(0, 10) + ' 11:00:00',
      totalVolume: volume,
      durationSeconds: 3600,
      exerciseCount: 3,
      routineDayName: null,
      exerciseNames: '',
    };
  }

  it('fires when volume dropped more than 20% from last week', () => {
    const data = makeData({
      workouts: [makeThisWeekWorkout(400), makeLastWeekWorkout(2000)] as any,
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'VOLUME_DROP')).toBe(true);
  });

  it('does not fire when drop is less than 20%', () => {
    const data = makeData({
      workouts: [makeThisWeekWorkout(900), makeLastWeekWorkout(1000)] as any,
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'VOLUME_DROP')).toBe(false);
  });
});

describe('generateInsights: checkConsistencyStreak', () => {
  // The streak check counts weeks where at least one workout is in [weekStart, nextWeekStart).
  // "This week" range is [thisMonday, today). A workout from today is excluded.
  // We pick daysFromMon (days since Monday, min 1 to avoid Monday edge case).
  function weeklyDays(): number[] {
    const utcDay = new Date().getUTCDay(); // 0=Sun
    const daysFromMon = utcDay === 0 ? 6 : utcDay - 1; // 0=Mon, 1=Tue, ...
    const base = daysFromMon > 0 ? daysFromMon : 7; // at least 1, skip Mondays
    return [base, base + 7, base + 14, base + 21];
  }

  it('fires with 4 consecutive weeks of workouts', () => {
    const workouts = weeklyDays().map((d) => makeWorkout(d));
    const data = makeData({ workouts });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'CONSISTENCY_STREAK')).toBe(true);
  });

  it('does not fire with gap in weeks', () => {
    const days = weeklyDays();
    // skip the second week (index 1) to create a gap
    const workouts = [days[0], days[2], days[3]].map((d) => makeWorkout(d));
    const data = makeData({ workouts });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'CONSISTENCY_STREAK')).toBe(false);
  });
});

describe('generateInsights: checkOvertrainingRisk', () => {
  it('fires when 6+ consecutive days of workouts', () => {
    const workouts = [0, 1, 2, 3, 4, 5].map((d) => makeWorkout(d));
    const data = makeData({ workouts });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'OVERTRAINING_RISK')).toBe(true);
  });

  it('does not fire with 5 consecutive days', () => {
    const workouts = [0, 1, 2, 3, 4].map((d) => makeWorkout(d));
    const data = makeData({ workouts });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'OVERTRAINING_RISK')).toBe(false);
  });
});

describe('generateInsights: checkLongSession', () => {
  it('fires when last workout exceeded 90 min', () => {
    const w = makeWorkout(0, 1000, 100 * 60); // 100 min
    const data = makeData({ workouts: [w] });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'LONG_SESSION')).toBe(true);
  });

  it('does not fire when session is 90 min or under', () => {
    const w = makeWorkout(0, 1000, 90 * 60);
    const data = makeData({ workouts: [w] });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'LONG_SESSION')).toBe(false);
  });

  it('message includes minute count', () => {
    const w = makeWorkout(0, 1000, 120 * 60);
    const data = makeData({ workouts: [w] });
    const result = generateInsights(data);
    const insight = result.find((i) => i.id === 'LONG_SESSION');
    expect(insight!.message).toMatch(/120/);
  });
});

// ─── generateInsights — body weight rules ────────────────────────────────────

describe('generateInsights: checkGoalReached', () => {
  it('fires when current weight is within 0.5kg of goal', () => {
    const data = makeData({
      phaseGoalWeight: 80,
      bodyWeightEntries: [makeBwEntry(0, 80.3)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'GOAL_REACHED')).toBe(true);
  });

  it('does not fire when more than 0.5kg away', () => {
    const data = makeData({
      phaseGoalWeight: 80,
      bodyWeightEntries: [makeBwEntry(0, 81.5)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'GOAL_REACHED')).toBe(false);
  });
});

describe('generateInsights: checkCloseToGoal', () => {
  it('fires when 0.5–2kg away from goal', () => {
    const data = makeData({
      phaseGoalWeight: 80,
      bodyWeightEntries: [makeBwEntry(0, 81.5)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'CLOSE_TO_GOAL')).toBe(true);
  });

  it('does not fire when more than 2kg away', () => {
    const data = makeData({
      phaseGoalWeight: 80,
      bodyWeightEntries: [makeBwEntry(0, 85)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'CLOSE_TO_GOAL')).toBe(false);
  });
});

describe('generateInsights: checkNoWeightLogged', () => {
  it('fires when no entry in last 3 days', () => {
    const data = makeData({
      bodyWeightEntries: [makeBwEntry(4, 80)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'NO_WEIGHT_LOGGED')).toBe(true);
  });

  it('does not fire when entry logged within 3 days', () => {
    const data = makeData({
      bodyWeightEntries: [makeBwEntry(1, 80)],
    });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'NO_WEIGHT_LOGGED')).toBe(false);
  });
});

// ─── generateInsights — water rules ──────────────────────────────────────────

describe('generateInsights: checkHydrationGreat', () => {
  it('fires when 5+ of last 7 days hit goal', () => {
    const entries = Array.from({ length: 7 }, (_, i) => makeWaterEntry(i, 3000));
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'HYDRATION_GREAT')).toBe(true);
  });

  it('does not fire when fewer than 5 days hit goal', () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) => makeWaterEntry(i, 3000)),
      ...Array.from({ length: 3 }, (_, i) => makeWaterEntry(i + 4, 500)),
    ];
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'HYDRATION_GREAT')).toBe(false);
  });
});

describe('generateInsights: checkHydrationPoor', () => {
  it('fires when 2 or fewer of last 7 days hit goal', () => {
    const entries = [
      ...Array.from({ length: 2 }, (_, i) => makeWaterEntry(i, 3000)),
      ...Array.from({ length: 5 }, (_, i) => makeWaterEntry(i + 2, 500)),
    ];
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'HYDRATION_POOR')).toBe(true);
  });
});

describe('generateInsights: checkWaterStreak', () => {
  it('fires when 7+ consecutive days hitting goal', () => {
    const entries = Array.from({ length: 8 }, (_, i) => makeWaterEntry(i, 3000));
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'WATER_STREAK')).toBe(true);
  });

  it('does not fire when streak broken before 7', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => makeWaterEntry(i, 3000)),
      makeWaterEntry(5, 100), // broke the streak
      makeWaterEntry(6, 3000),
    ];
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    const result = generateInsights(data);
    expect(result.some((i) => i.id === 'WATER_STREAK')).toBe(false);
  });
});

// ─── computeDailyMood ─────────────────────────────────────────────────────────

describe('computeDailyMood', () => {
  it('returns excited when recent PR in last 24h', () => {
    const data = makeData({ personalRecords: [makePR(1, 2)] });
    expect(computeDailyMood(data)).toBe('excited');
  });

  it('returns excited on milestone workout count', () => {
    const data = makeData({ totalWorkoutCount: 10 });
    expect(computeDailyMood(data)).toBe('excited');
  });

  it('returns excited on first workout', () => {
    const data = makeData({ totalWorkoutCount: 1 });
    expect(computeDailyMood(data)).toBe('excited');
  });

  it('returns excited when goal weight reached', () => {
    const data = makeData({
      phaseGoalWeight: 80,
      bodyWeightEntries: [makeBwEntry(0, 80.2)],
    });
    expect(computeDailyMood(data)).toBe('excited');
  });

  it('returns thinking when 4+ days missed with active routine', () => {
    const data = makeData({
      activeRoutineId: '1',
      workouts: [makeWorkout(5)],
    });
    expect(computeDailyMood(data)).toBe('thinking');
  });

  it('does not return thinking for recent workout', () => {
    const data = makeData({
      activeRoutineId: '1',
      workouts: [makeWorkout(1)],
    });
    const mood = computeDailyMood(data);
    expect(mood).not.toBe('thinking');
  });

  it('returns happy for great hydration week', () => {
    const entries = Array.from({ length: 7 }, (_, i) => makeWaterEntry(i, 3000));
    const data = makeData({ waterEntries: entries as any, dailyWaterGoalMl: 2500 });
    expect(computeDailyMood(data)).toBe('happy');
  });

  it('returns happy for 4-week consistency streak', () => {
    const utcDay = new Date().getUTCDay();
    const daysFromMon = utcDay === 0 ? 6 : utcDay - 1;
    const base = daysFromMon > 0 ? daysFromMon : 7;
    const workouts = [base, base + 7, base + 14, base + 21].map((d) => makeWorkout(d));
    const data = makeData({ workouts });
    expect(computeDailyMood(data)).toBe('happy');
  });

  it('returns a valid DailyMood for empty data', () => {
    const validMoods: DailyMood[] = ['happy', 'thinking', 'excited', 'neutral'];
    const data = makeData();
    expect(validMoods).toContain(computeDailyMood(data));
  });

  it('excited beats missed-days for same data', () => {
    // PR + missed days → PR wins → excited
    const data = makeData({
      personalRecords: [makePR(1, 2)],
      activeRoutineId: '1',
      workouts: [makeWorkout(6)],
    });
    expect(computeDailyMood(data)).toBe('excited');
  });
});

// ─── generateInsights — no crash on empty data ────────────────────────────────

describe('generateInsights: stability', () => {
  it('returns empty array for minimal data', () => {
    const result = generateInsights(makeData());
    expect(Array.isArray(result)).toBe(true);
  });

  it('never throws even with malformed entries', () => {
    const data = makeData({
      workouts: [{ id: 1, startedAt: 'invalid-date', finishedAt: null, totalVolume: NaN, durationSeconds: 0, exerciseCount: 0, routineDayName: null, exerciseNames: '' }] as any,
    });
    expect(() => generateInsights(data)).not.toThrow();
  });

  it('all returned insights have required fields', () => {
    const workouts = [0, 7, 14, 21].map((d) => makeWorkout(d));
    const data = makeData({
      workouts,
      totalWorkoutCount: 10,
      personalRecords: [makePR(1, 1)],
      waterEntries: Array.from({ length: 7 }, (_, i) => makeWaterEntry(i, 3000)) as any,
      dailyWaterGoalMl: 2500,
    });
    const result = generateInsights(data);
    for (const insight of result) {
      expect(typeof insight.id).toBe('string');
      expect(typeof insight.title).toBe('string');
      expect(typeof insight.message).toBe('string');
      expect(['workout', 'weight', 'water', 'recovery', 'milestone']).toContain(insight.category);
      expect([1, 2, 3]).toContain(insight.priority);
    }
  });
});
