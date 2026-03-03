import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line as SvgLine, Path, Text as SvgText } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '../../store/useHistoryStore';
import { getBestSetPerSession, getExerciseHistory, getPRForExercise } from '../../db/historyQueries';
import ExercisePicker from '../../components/ExercisePicker';
import StatsOverview from '../../components/StatsOverview';
import WeeklyVolumeChart from '../../components/WeeklyVolumeChart';
import MuscleGroupChart from '../../components/MuscleGroupChart';
import {
  BestSetPerSession,
  ExerciseSession,
  PRWithName,
  WorkoutSummary,
} from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
  return `${Math.round(vol)} kg`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Swipeable Workout Card ────────────────────────────────────────────────

const DELETE_WIDTH = 72;

interface SwipeableWorkoutCardProps {
  workout: WorkoutSummary;
  onPress: () => void;
  onDelete: () => void;
}

function SwipeableWorkoutCard({ workout, onPress, onDelete }: SwipeableWorkoutCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const clamped = Math.max(-DELETE_WIDTH, Math.min(0, dx + base));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        if (dx + base < -DELETE_WIDTH / 2) {
          Animated.spring(translateX, { toValue: -DELETE_WIDTH, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  const handleDeletePress = () => {
    close();
    Alert.alert(
      'Delete Workout',
      `Delete workout from ${formatDate(workout.startedAt)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const names = workout.exerciseNames ? workout.exerciseNames.split(',') : [];
  const preview = names.slice(0, 3).join(', ');
  const moreCount = Math.max(0, names.length - 3);

  return (
    <View style={styles.swipeWrapper}>
      <View style={styles.deleteZone}>
        <Pressable style={styles.deleteAction} onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={20} color={Colors.text} />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <Pressable
          style={({ pressed }) => [styles.workoutCard, pressed && styles.workoutCardPressed]}
          onPress={() => {
            if (isOpen.current) { close(); } else { onPress(); }
          }}
        >
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardDate}>{formatDate(workout.startedAt)}</Text>
            {workout.routineDayName ? (
              <Text style={styles.cardDayName}> · {workout.routineDayName}</Text>
            ) : null}
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>{formatDuration(workout.durationSeconds)}</Text>
            <Text style={styles.cardMetaDot}>·</Text>
            <Text style={styles.cardMetaText}>{formatVolume(workout.totalVolume)}</Text>
          </View>
          {preview.length > 0 && (
            <Text style={styles.cardExercises} numberOfLines={1}>
              {preview}{moreCount > 0 ? ` +${moreCount}` : ''}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Progress Line Chart (SVG) ─────────────────────────────────────────────

const CHART_H = 180;
const PAD_LEFT = 44;
const PAD_BOTTOM = 28;
const PAD_TOP = 10;
const SCREEN_W = Dimensions.get('window').width;

function ProgressChart({ data }: { data: BestSetPerSession[] }) {
  if (data.length < 2) {
    return (
      <View style={styles.noData}>
        <Text style={styles.noDataText}>Log at least 2 sessions to see progress</Text>
      </View>
    );
  }

  const chartWidth = SCREEN_W - Spacing.lg * 4;
  const plotW = chartWidth - PAD_LEFT;
  const plotH = CHART_H - PAD_BOTTOM - PAD_TOP;
  const values = data.map((d) => d.estimated1rm);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const range = maxY - minY || 1;

  const getX = (i: number) => PAD_LEFT + (i / (data.length - 1)) * plotW;
  const getY = (v: number) => PAD_TOP + (1 - (v - minY) / range) * plotH;

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(d.estimated1rm).toFixed(1)}`)
    .join(' ');

  const yLabels = [0, 1, 2, 3].map((i) => {
    const val = minY + (range / 3) * i;
    return { val: Math.round(val), y: getY(val) };
  });

  const xIndices = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <View style={{ height: CHART_H }}>
      <Svg width={chartWidth} height={CHART_H}>
        {yLabels.map(({ val, y }) => (
          <G key={val}>
            <SvgLine x1={PAD_LEFT} y1={y} x2={chartWidth} y2={y} stroke={Colors.border} strokeWidth={1} />
            <SvgText x={PAD_LEFT - 4} y={y + 4} fill={Colors.textTertiary} fontSize={9} textAnchor="end">
              {val}
            </SvgText>
          </G>
        ))}
        <Path d={pathD} stroke={Colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
        {data.map((d, i) => (
          <Circle key={i} cx={getX(i)} cy={getY(d.estimated1rm)} r={4} fill={Colors.primary} />
        ))}
        {xIndices.map((i) => (
          <SvgText key={i} x={getX(i)} y={CHART_H - 6} fill={Colors.textTertiary} fontSize={9} textAnchor="middle">
            {formatDateShort(data[i].date)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ─── Workouts Tab ──────────────────────────────────────────────────────────

function WorkoutsTab() {
  const workouts = useHistoryStore((s) => s.workouts);
  const hasMore = useHistoryStore((s) => s.hasMore);
  const isLoadingMore = useHistoryStore((s) => s.isLoadingMore);
  const loadMoreWorkouts = useHistoryStore((s) => s.loadMoreWorkouts);
  const deleteWorkout = useHistoryStore((s) => s.deleteWorkout);

  return (
    <FlatList
      data={workouts}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <>
          <StatsOverview />
          <WeeklyVolumeChart />
          <View style={styles.logHeader}>
            <Text style={styles.logHeaderText}>WORKOUT LOG</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyList}>
          <Text style={styles.emptyListText}>No workouts yet</Text>
          <Text style={styles.emptyListHint}>Finish a workout to see it here</Text>
        </View>
      }
      renderItem={({ item }) => (
        <SwipeableWorkoutCard
          workout={item}
          onPress={() => router.push(`/history/${item.id}`)}
          onDelete={() => deleteWorkout(item.id)}
        />
      )}
      onEndReached={loadMoreWorkouts}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.loadingMore}>
            <Text style={styles.loadingMoreText}>Loading…</Text>
          </View>
        ) : !hasMore && workouts.length > 0 ? (
          <View style={styles.loadingMore}>
            <Text style={styles.loadingMoreText}>All workouts loaded</Text>
          </View>
        ) : null
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

// ─── Progress Tab ──────────────────────────────────────────────────────────

function ProgressTab() {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [chartData, setChartData] = useState<BestSetPerSession[]>([]);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [pr, setPr] = useState<PRWithName | null>(null);

  const handleSelect = (id: number, name: string) => {
    setSelected({ id, name });
    setChartData(getBestSetPerSession(id));
    setSessions(getExerciseHistory(id, 20));
    setPr(getPRForExercise(id));
    setPickerVisible(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.progressContent}>
      <Pressable
        style={({ pressed }) => [styles.exercisePickerBtn, pressed && styles.exercisePickerBtnPressed]}
        onPress={() => setPickerVisible(true)}
      >
        <Ionicons name="barbell-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.exercisePickerText} numberOfLines={1}>
          {selected ? selected.name : 'Select Exercise'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
      </Pressable>

      {selected && (
        <>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>ESTIMATED 1RM PROGRESS</Text>
            <ProgressChart data={chartData} />
          </View>

          {pr && (
            <View style={styles.prCard}>
              <Ionicons name="trophy" size={18} color={Colors.primary} />
              <View style={styles.prCardInfo}>
                <Text style={styles.prCardLabel}>Personal Record</Text>
                <Text style={styles.prCardValue}>
                  {pr.weight_kg}kg × {pr.reps} reps
                </Text>
              </View>
              <Text style={styles.prCardEst}>~{Math.round(pr.estimated_1rm)}kg 1RM</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>SESSION HISTORY</Text>

          {sessions.length === 0 && (
            <Text style={styles.emptyListHint}>No sessions yet</Text>
          )}

          {sessions.map((session) => (
            <View key={session.workoutId} style={styles.sessionCard}>
              <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
              {session.sets.map((s, si) => (
                <View key={si} style={styles.sessionSetRow}>
                  <Text style={styles.sessionSetNum}>Set {si + 1}</Text>
                  <Text style={styles.sessionSetDetail}>
                    {s.weightKg}kg × {s.reps}
                  </Text>
                  <Text style={styles.sessionSetEst}>~{Math.round(s.estimated1rm)}kg</Text>
                </View>
              ))}
            </View>
          ))}

          <MuscleGroupChart />
        </>
      )}

      <ExercisePicker
        visible={pickerVisible}
        onSelect={handleSelect}
        onClose={() => setPickerVisible(false)}
      />
    </ScrollView>
  );
}

// ─── Records Tab ───────────────────────────────────────────────────────────

function RecordsTab() {
  const prs = useHistoryStore((s) => s.prs);

  if (prs.length === 0) {
    return (
      <View style={styles.emptyList}>
        <Text style={styles.emptyListText}>No personal records yet</Text>
        <Text style={styles.emptyListHint}>Complete workouts to earn PRs</Text>
      </View>
    );
  }

  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const grouped = new Map<string, PRWithName[]>();
  for (const pr of prs) {
    const group = grouped.get(pr.muscleGroup) ?? [];
    group.push(pr);
    grouped.set(pr.muscleGroup, group);
  }

  return (
    <ScrollView contentContainerStyle={styles.recordsContent}>
      {Array.from(grouped.entries()).map(([group, groupPRs]) => (
        <View key={group} style={styles.prGroup}>
          <Text style={styles.prGroupLabel}>{group.toUpperCase()}</Text>
          {groupPRs.map((pr) => {
            const achievedMs = new Date(
              pr.achieved_at.includes('T') ? pr.achieved_at : pr.achieved_at.replace(' ', 'T') + 'Z'
            ).getTime();
            const isRecent = achievedMs > sevenDaysAgo;
            return (
              <View key={pr.id} style={[styles.prRow, isRecent && styles.prRowRecent]}>
                <View style={styles.prRowLeft}>
                  <Text style={[styles.prRowName, isRecent && styles.prRowNameRecent]}>
                    {pr.exerciseName}
                  </Text>
                  <Text style={styles.prRowDate}>{formatDateShort(pr.achieved_at)}</Text>
                </View>
                <View style={styles.prRowRight}>
                  <Text style={[styles.prRowWeight, isRecent && styles.prRowWeightRecent]}>
                    {pr.weight_kg}kg × {pr.reps}
                  </Text>
                  <Text style={styles.prRowEst}>~{Math.round(pr.estimated_1rm)}kg 1RM</Text>
                </View>
                {isRecent && (
                  <Ionicons name="trophy" size={14} color={Colors.primary} />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── History Screen ────────────────────────────────────────────────────────

type TabKey = 'workouts' | 'progress' | 'records';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'workouts', label: 'Workouts' },
  { key: 'progress', label: 'Progress' },
  { key: 'records', label: 'Records' },
];

export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('workouts');
  const loadWorkouts = useHistoryStore((s) => s.loadWorkouts);
  const loadPRs = useHistoryStore((s) => s.loadPRs);
  const loadStats = useHistoryStore((s) => s.loadStats);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
      loadPRs();
      loadStats();
    }, [loadWorkouts, loadPRs, loadStats])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === 'workouts' && <WorkoutsTab />}
        {activeTab === 'progress' && <ProgressTab />}
        {activeTab === 'records' && <RecordsTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  tabTextActive: { color: Colors.background },
  content: { flex: 1 },

  // Workout list
  listContent: { paddingBottom: Spacing.xxxl },
  logHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  logHeaderText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swipeWrapper: { overflow: 'hidden' },
  deleteZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { alignItems: 'center', gap: 2 },
  deleteActionText: {
    color: Colors.text,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  workoutCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  workoutCardPressed: { opacity: 0.85 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardDate: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  cardDayName: { color: Colors.textSecondary, fontSize: Typography.size.md },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardMetaText: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  cardMetaDot: { color: Colors.textTertiary, fontSize: Typography.size.sm },
  cardExercises: { color: Colors.textTertiary, fontSize: Typography.size.xs },
  emptyList: { alignItems: 'center', paddingTop: Spacing.xxxl, gap: Spacing.sm },
  emptyListText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  emptyListHint: { color: Colors.textTertiary, fontSize: Typography.size.sm },
  loadingMore: { alignItems: 'center', padding: Spacing.lg },
  loadingMoreText: { color: Colors.textTertiary, fontSize: Typography.size.sm },

  // Progress tab
  progressContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxxl },
  exercisePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exercisePickerBtnPressed: { opacity: 0.85 },
  exercisePickerText: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  chartTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  noData: { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: Colors.textTertiary, fontSize: Typography.size.sm, textAlign: 'center' },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  prCardInfo: { flex: 1, gap: 2 },
  prCardLabel: {
    color: Colors.primary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prCardValue: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  prCardEst: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  sessionDate: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    marginBottom: 2,
  },
  sessionSetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sessionSetNum: { color: Colors.textTertiary, fontSize: Typography.size.xs, width: 36 },
  sessionSetDetail: { flex: 1, color: Colors.textSecondary, fontSize: Typography.size.sm },
  sessionSetEst: { color: Colors.textTertiary, fontSize: Typography.size.xs },

  // Records tab
  recordsContent: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxxl },
  prGroup: { gap: Spacing.sm },
  prGroupLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  prRowRecent: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  prRowLeft: { flex: 1, gap: 2 },
  prRowName: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  prRowNameRecent: { color: Colors.primary },
  prRowDate: { color: Colors.textTertiary, fontSize: Typography.size.xs },
  prRowRight: { alignItems: 'flex-end', gap: 2 },
  prRowWeight: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  prRowWeightRecent: { color: Colors.text },
  prRowEst: { color: Colors.textTertiary, fontSize: Typography.size.xs },
});
