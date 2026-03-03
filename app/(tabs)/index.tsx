import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Polyline } from 'react-native-svg';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useRoutineStore } from '../../store/useRoutineStore';
import { useBodyWeightStore } from '../../store/useBodyWeightStore';
import { getRecentWorkouts } from '../../db/workoutQueries';
import { getWeekStats } from '../../db/historyQueries';
import { getSetting } from '../../db/settingsQueries';
import { kgToDisplay, formatVolume, WeightUnit } from '../../utils/weightUtils';
import { BodyWeightEntry, Workout, RoutineDayWithExercises } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

const PHASE_COLOR: Record<string, string> = {
  cut: Colors.error,
  bulk: Colors.success,
  maintain: '#4488FF',
};

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—';
  const diff = Math.floor((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Sparkline ─────────────────────────────────────────────────────────────

interface SparklineProps {
  entries: BodyWeightEntry[];
  unit: WeightUnit;
}

function Sparkline({ entries, unit }: SparklineProps) {
  const [width, setWidth] = useState(0);
  const H = 40;
  const PAD = 4;

  const display = entries.map((e) => kgToDisplay(e.weight_kg, unit));
  const min = Math.min(...display);
  const max = Math.max(...display);
  const range = max - min || 1;

  const points =
    width > 0 && display.length >= 2
      ? display
          .map((w, i) => {
            const x = PAD + (i / (display.length - 1)) * (width - PAD * 2);
            const y = H - PAD - ((w - min) / range) * (H - PAD * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

  return (
    <View style={{ height: H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {points !== '' && (
        <Svg width={width} height={H}>
          <Polyline
            points={points}
            fill="none"
            stroke={Colors.primary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </View>
  );
}

// ─── Swap Day Modal ────────────────────────────────────────────────────────

interface SwapDayModalProps {
  visible: boolean;
  days: RoutineDayWithExercises[];
  onSelect: (day: RoutineDayWithExercises) => void;
  onClose: () => void;
}

function SwapDayModal({ visible, days, onSelect, onClose }: SwapDayModalProps) {
  const nonRestDays = days.filter((d) => d.exercises.length > 0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>Choose a Day</Text>
        <FlatList
          data={nonRestDays}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.swapRow, pressed && styles.swapRowPressed]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onSelect(item);
                onClose();
              }}
            >
              <Text style={styles.swapDayName}>{item.name}</Text>
              <Text style={styles.swapDayMeta}>{item.exercises.length} exercises</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

// ─── Today's Workout Card ──────────────────────────────────────────────────

interface TodaysCardProps {
  onStartWithDay: (routineDayId: number) => void;
  onStartBlank: () => void;
}

function TodaysCard({ onStartWithDay, onStartBlank }: TodaysCardProps) {
  const { routines, activeRoutineId, todaysRoutineDay, loadTodaysDay, skipDay } = useRoutineStore();
  const [swapVisible, setSwapVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTodaysDay();
    }, [loadTodaysDay])
  );

  if (!activeRoutineId) {
    return (
      <Pressable style={styles.setupCard} onPress={() => router.push('/(tabs)/routines')}>
        <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
        <Text style={styles.setupText}>Set up your routine →</Text>
      </Pressable>
    );
  }

  if (!todaysRoutineDay) {
    return (
      <Pressable
        style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
        onPress={onStartBlank}
      >
        <Ionicons name="barbell-outline" size={22} color={Colors.background} />
        <Text style={styles.startButtonText}>Start Workout</Text>
      </Pressable>
    );
  }

  const previewExercises = todaysRoutineDay.exercises.slice(0, 3);
  const remaining = todaysRoutineDay.exercises.length - previewExercises.length;
  const activeRoutine = routines.find((r) => r.id === activeRoutineId);

  return (
    <View style={styles.todaysCard}>
      <Text style={styles.todayLabel}>Today</Text>
      <Text style={styles.todayDayName}>{todaysRoutineDay.name}</Text>

      {previewExercises.length > 0 && (
        <View style={styles.exercisePreview}>
          {previewExercises.map((ex) => (
            <Text key={ex.exercise_id} style={styles.previewExercise}>
              · {ex.exercise_name}
            </Text>
          ))}
          {remaining > 0 && (
            <Text style={styles.previewMore}>and {remaining} more</Text>
          )}
        </View>
      )}

      <View style={styles.todayActions}>
        <Pressable
          style={({ pressed }) => [styles.startTodayBtn, pressed && styles.startTodayBtnPressed]}
          onPress={() => onStartWithDay(todaysRoutineDay.id)}
        >
          <Ionicons name="play" size={16} color={Colors.background} />
          <Text style={styles.startTodayText}>Start</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
          onPress={() => setSwapVisible(true)}
        >
          <Text style={styles.secondaryBtnText}>Swap Day</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            skipDay();
          }}
        >
          <Text style={styles.secondaryBtnText}>Skip</Text>
        </Pressable>
      </View>

      <SwapDayModal
        visible={swapVisible}
        days={activeRoutine?.days ?? []}
        onSelect={(day) => onStartWithDay(day.id)}
        onClose={() => setSwapVisible(false)}
      />
    </View>
  );
}

// ─── Home Screen ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { activeWorkout, elapsedSeconds, startWorkout } = useWorkoutStore();
  const {
    entries: bwEntries,
    stats: bwStats,
    phaseInfo,
    loadEntries: loadBwEntries,
    loadStats: loadBwStats,
    loadPhaseInfo,
  } = useBodyWeightStore();
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [weekStats, setWeekStats] = useState<{ count: number; volume: number }>({ count: 0, volume: 0 });

  const refresh = useCallback(() => {
    const recents = getRecentWorkouts(1);
    setLastWorkout(recents[0] ?? null);
    setWeekStats(getWeekStats());
    const savedUnit = getSetting('weight_unit');
    setUnit(savedUnit === 'lbs' ? 'lbs' : 'kg');
    loadBwEntries();
    loadBwStats();
    loadPhaseInfo();
  }, [loadBwEntries, loadBwStats, loadPhaseInfo]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    refresh();
  }, [activeWorkout, refresh]);

  const handleStartWithDay = useCallback(
    (routineDayId: number) => {
      if (activeWorkout) {
        router.push('/workout/active');
        return;
      }
      startWorkout(routineDayId);
      router.push('/workout/active');
    },
    [activeWorkout, startWorkout]
  );

  const handleStartBlank = useCallback(() => {
    if (activeWorkout) {
      router.push('/workout/active');
      return;
    }
    startWorkout();
    router.push('/workout/active');
  }, [activeWorkout, startWorkout]);

  const todayWeight =
    bwStats?.current != null ? kgToDisplay(bwStats.current, unit) : null;
  const sparkEntries = [...bwEntries.slice(0, 7)].reverse();
  const phaseColor = phaseInfo?.phase ? PHASE_COLOR[phaseInfo.phase] : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>RepLogger</Text>

      {activeWorkout ? (
        <Pressable
          style={({ pressed }) => [styles.resumeCard, pressed && styles.cardPressed]}
          onPress={() => router.push('/workout/active')}
        >
          <View style={styles.resumeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.resumeLabel}>Workout in progress</Text>
          </View>
          <Text style={styles.resumeTime}>{formatElapsed(elapsedSeconds)}</Text>
          <Text style={styles.resumeSub}>
            {activeWorkout.exercises.length} exercise
            {activeWorkout.exercises.length !== 1 ? 's' : ''} · Tap to resume
          </Text>
        </Pressable>
      ) : (
        <TodaysCard onStartWithDay={handleStartWithDay} onStartBlank={handleStartBlank} />
      )}

      {!activeWorkout && weekStats.count > 0 && (
        <Pressable
          style={({ pressed }) => [styles.statsStrip, pressed && styles.statsStripPressed]}
          onPress={() => router.push('/(tabs)/history')}
        >
          <Text style={styles.statsStripText}>
            This week: {weekStats.count} workout{weekStats.count !== 1 ? 's' : ''} ·{' '}
            {formatVolume(weekStats.volume, unit)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.bwCard, pressed && styles.cardPressed]}
        onPress={() => router.push('/bodyweight')}
      >
        <View style={styles.bwHeader}>
          <Text style={styles.sectionTitle}>Body Weight</Text>
          {phaseColor && phaseInfo?.phase ? (
            <View style={[styles.phaseBadge, { borderColor: phaseColor }]}>
              <Text style={[styles.phaseBadgeText, { color: phaseColor }]}>
                {phaseInfo.phase.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.bwValue}>
          {todayWeight !== null ? `${todayWeight} ${unit}` : '—'}
        </Text>

        {sparkEntries.length >= 2 && <Sparkline entries={sparkEntries} unit={unit} />}

        <View style={styles.bwFooter}>
          <Text style={styles.bwLogLink}>+ Log Weight</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </View>
      </Pressable>

      {lastWorkout && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Workout</Text>
          <View style={styles.lastWorkoutCard}>
            <Text style={styles.lastWorkoutDate}>{formatDate(lastWorkout.started_at)}</Text>
            <Text style={styles.lastWorkoutDuration}>
              {formatDuration(lastWorkout.started_at, lastWorkout.finished_at)}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },
  pageTitle: {
    color: Colors.primary,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    letterSpacing: -0.5,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
  },
  startButtonPressed: { opacity: 0.85 },
  startButtonText: {
    color: Colors.background,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setupText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
  },
  todaysCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  todayLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  todayDayName: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  exercisePreview: {
    gap: 2,
    paddingBottom: Spacing.xs,
  },
  previewExercise: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  previewMore: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    marginTop: 2,
  },
  todayActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  startTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  startTodayBtnPressed: { opacity: 0.85 },
  startTodayText: {
    color: Colors.background,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  secondaryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnPressed: { backgroundColor: Colors.surfaceElevated },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  resumeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.xs,
  },
  cardPressed: { opacity: 0.85 },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  resumeLabel: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resumeTime: {
    color: Colors.text,
    fontSize: Typography.size.xxxl,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  resumeSub: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  section: { gap: Spacing.sm },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lastWorkoutCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lastWorkoutDate: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  lastWorkoutDuration: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '60%',
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.md,
  },
  swapRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  swapRowPressed: { backgroundColor: Colors.surfaceElevated },
  swapDayName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  swapDayMeta: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsStripPressed: { opacity: 0.8 },
  statsStripText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  bwCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  bwHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bwValue: {
    color: Colors.text,
    fontSize: Typography.size.xxxl,
    fontWeight: Typography.weight.bold,
  },
  phaseBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  phaseBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    letterSpacing: 0.5,
  },
  bwFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  bwLogLink: {
    flex: 1,
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
});
