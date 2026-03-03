import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, G, Line as SvgLine, Path, Text as SvgText } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useBodyWeightStore } from '../../store/useBodyWeightStore';
import { getBodyWeightRange } from '../../db/bodyWeightQueries';
import { getWorkoutHistory } from '../../db/historyQueries';
import { getSetting } from '../../db/settingsQueries';
import PhaseSelector from '../../components/PhaseSelector';
import { BodyWeightEntry, WorkoutPhase } from '../../types';
import { WeightUnit, kgToDisplay, displayToKg, formatWeight } from '../../utils/weightUtils';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

// ─── Constants ─────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<string, string> = {
  cut: Colors.error,
  bulk: Colors.success,
  maintain: '#4488FF',
};

const PHASE_MUTED: Record<string, string> = {
  cut: '#FF444420',
  bulk: '#00C85120',
  maintain: '#4488FF20',
};

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 240;
const PAD_LEFT = 46;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const PAGE_SIZE = 30;

type TimeRange = '1M' | '3M' | '6M' | 'All';

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseDateMs(s: string): number {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime();
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMonthHeader(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysElapsed(startDateStr: string): number {
  const start = new Date(startDateStr + 'T00:00:00Z').getTime();
  return Math.floor((Date.now() - start) / 86400000);
}

// ─── Body Weight Chart ─────────────────────────────────────────────────────

interface ChartProps {
  rawEntries: BodyWeightEntry[];
  movingAverage: { date: string; average: number }[];
  goalWeightKg: number | null;
  phaseStartDate: string | null;
  workoutDates: string[];
  unit: WeightUnit;
}

function BodyWeightChart({
  rawEntries,
  movingAverage,
  goalWeightKg,
  phaseStartDate,
  workoutDates,
  unit,
}: ChartProps) {
  const chartWidth = SCREEN_W - Spacing.lg * 2;
  const plotW = chartWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  if (rawEntries.length === 0) {
    return (
      <View style={[styles.chartContainer, styles.chartEmpty]}>
        <Text style={styles.chartEmptyText}>Log your starting weight to begin tracking</Text>
      </View>
    );
  }

  // Compute date range
  const dates = rawEntries.map((e) => parseDateMs(e.recorded_at));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  // Compute weight range
  const weights = rawEntries.map((e) => e.weight_kg);
  if (goalWeightKg != null) weights.push(goalWeightKg);
  const maWeights = movingAverage.map((m) => m.average);
  const allWeights = [...weights, ...maWeights];
  const minW = Math.min(...allWeights) - 1;
  const maxW = Math.max(...allWeights) + 1;
  const wRange = maxW - minW || 1;

  const getX = (dateMs: number) => PAD_LEFT + ((dateMs - minDate) / dateRange) * plotW;
  const getY = (w: number) => PAD_TOP + (1 - (w - minW) / wRange) * plotH;

  // Y axis labels
  const ySteps = 3;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const wKg = minW + (wRange / ySteps) * i;
    return { val: kgToDisplay(wKg, unit), y: getY(wKg) };
  });

  // X axis labels (3 evenly spaced)
  const xIndices = [0, Math.floor((rawEntries.length - 1) / 2), rawEntries.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  // Moving average line
  const maInRange = movingAverage.filter((m) => {
    const ms = parseDateMs(m.date);
    return ms >= minDate && ms <= maxDate;
  });
  const maPath =
    maInRange.length >= 2
      ? maInRange
          .map((m, i) => {
            const x = getX(parseDateMs(m.date));
            const y = getY(m.average);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : null;

  // Goal line y
  const goalY = goalWeightKg != null ? getY(goalWeightKg) : null;

  // Phase start line x
  const phaseX =
    phaseStartDate != null
      ? (() => {
          const ms = parseDateMs(phaseStartDate);
          if (ms >= minDate && ms <= maxDate) return getX(ms);
          return null;
        })()
      : null;

  // Workout date ticks
  const workoutTicks = workoutDates
    .map((d) => parseDateMs(d))
    .filter((ms) => ms >= minDate && ms <= maxDate)
    .map((ms) => getX(ms));

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={CHART_H}>
        {/* Grid + Y labels */}
        {yLabels.map(({ val, y }) => (
          <G key={val}>
            <SvgLine x1={PAD_LEFT} y1={y} x2={chartWidth - PAD_RIGHT} y2={y} stroke={Colors.border} strokeWidth={1} />
            <SvgText x={PAD_LEFT - 4} y={y + 4} fill={Colors.textTertiary} fontSize={9} textAnchor="end">
              {val}
            </SvgText>
          </G>
        ))}

        {/* Phase start vertical dashed line */}
        {phaseX != null && (
          <SvgLine
            x1={phaseX}
            y1={PAD_TOP}
            x2={phaseX}
            y2={CHART_H - PAD_BOTTOM}
            stroke={Colors.primary}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.7}
          />
        )}

        {/* Goal weight dashed horizontal line */}
        {goalY != null && (
          <SvgLine
            x1={PAD_LEFT}
            y1={goalY}
            x2={chartWidth - PAD_RIGHT}
            y2={goalY}
            stroke={Colors.primary}
            strokeWidth={1}
            strokeDasharray="6,4"
            opacity={0.9}
          />
        )}

        {/* Moving average line */}
        {maPath && (
          <Path d={maPath} stroke={Colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" />
        )}

        {/* Raw entry dots */}
        {rawEntries.map((e, i) => (
          <Circle
            key={i}
            cx={getX(parseDateMs(e.recorded_at))}
            cy={getY(e.weight_kg)}
            r={3}
            fill={Colors.textTertiary}
          />
        ))}

        {/* X axis labels */}
        {xIndices.map((i) => {
          const e = rawEntries[i];
          return (
            <SvgText
              key={i}
              x={getX(parseDateMs(e.recorded_at))}
              y={CHART_H - 6}
              fill={Colors.textTertiary}
              fontSize={9}
              textAnchor="middle"
            >
              {formatDateLabel(e.recorded_at)}
            </SvgText>
          );
        })}

        {/* Workout date ticks */}
        {workoutTicks.map((x, i) => (
          <SvgLine
            key={i}
            x1={x}
            y1={CHART_H - PAD_BOTTOM + 2}
            x2={x}
            y2={CHART_H - PAD_BOTTOM + 8}
            stroke={Colors.textTertiary}
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
      </Svg>
    </View>
  );
}

// ─── Swipeable Entry Row ───────────────────────────────────────────────────

const DELETE_W = 72;

interface EntryRowProps {
  entry: BodyWeightEntry;
  unit: WeightUnit;
  onDelete: () => void;
}

function SwipeableEntryRow({ entry, unit, onDelete }: EntryRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_W : 0;
        translateX.setValue(Math.max(-DELETE_W, Math.min(0, dx + base)));
      },
      onPanResponderRelease: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_W : 0;
        if (dx + base < -DELETE_W / 2) {
          Animated.spring(translateX, { toValue: -DELETE_W, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
    Alert.alert('Delete Entry', 'Remove this weight entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={styles.swipeWrapper}>
      <View style={styles.deleteZone}>
        <Pressable style={styles.deleteAction} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={Colors.text} />
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        <View style={styles.entryRow}>
          <View>
            <Text style={styles.entryDate}>{formatDateLabel(entry.recorded_at)}</Text>
            {entry.notes ? <Text style={styles.entryNotes}>{entry.notes}</Text> : null}
          </View>
          <Text style={styles.entryWeight}>{formatWeight(entry.weight_kg, unit)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── List item type ─────────────────────────────────────────────────────────

type ListItem =
  | { type: 'header'; monthKey: string }
  | { type: 'entry'; entry: BodyWeightEntry };

function buildListData(entries: BodyWeightEntry[]): ListItem[] {
  const result: ListItem[] = [];
  let lastMonth = '';
  for (const entry of entries) {
    const month = entry.recorded_at.slice(0, 7);
    if (month !== lastMonth) {
      result.push({ type: 'header', monthKey: month });
      lastMonth = month;
    }
    result.push({ type: 'entry', entry });
  }
  return result;
}

// ─── Body Weight Screen ────────────────────────────────────────────────────

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', 'All'];

export default function BodyWeightScreen() {
  const {
    entries,
    hasMore,
    movingAverage,
    stats,
    phaseInfo,
    loadEntries,
    loadMoreEntries,
    loadStats,
    loadMovingAverage,
    loadPhaseInfo,
    logWeight,
    deleteEntry,
    setPhase,
  } = useBodyWeightStore();

  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [phaseSelectorVisible, setPhaseSelectorVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const weightInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const u = (getSetting('weight_unit') ?? 'kg') as WeightUnit;
      setUnit(u);
      loadEntries();
      loadStats();
      loadMovingAverage(7);
      loadPhaseInfo();
      // Load workout dates for correlation dots
      const workouts = getWorkoutHistory(100, 0);
      setWorkoutDates(workouts.map((w) => w.startedAt.slice(0, 10)));
      // Pre-fill with last entry
      const latest = entries[0];
      if (latest && !weightInput) {
        setWeightInput(String(kgToDisplay(latest.weight_kg, u)));
      }
    }, [])
  );

  // Filtered entries for chart
  const filteredEntries = useMemo(() => {
    if (timeRange === 'All') return [...entries].reverse();
    const now = Date.now();
    const days = timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : 180;
    const cutoff = now - days * 86400000;
    return [...entries].reverse().filter((e) => parseDateMs(e.recorded_at) >= cutoff);
  }, [entries, timeRange]);

  const filteredMA = useMemo(() => {
    if (timeRange === 'All') return movingAverage;
    const now = Date.now();
    const days = timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : 180;
    const cutoff = now - days * 86400000;
    return movingAverage.filter((m) => parseDateMs(m.date) >= cutoff);
  }, [movingAverage, timeRange]);

  // Check if logged today
  const todayStr = new Date().toISOString().slice(0, 10);
  const loggedToday = entries.some((e) => e.recorded_at.slice(0, 10) === todayStr);

  const handleLog = () => {
    const val = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight.');
      return;
    }
    const kg = displayToKg(val, unit);
    logWeight(kg, notesInput.trim() || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setNotesInput('');
  };

  // Compute stats in display unit
  const rangeChange = useMemo(() => {
    if (filteredEntries.length < 2) return null;
    return filteredEntries[filteredEntries.length - 1].weight_kg - filteredEntries[0].weight_kg;
  }, [filteredEntries]);

  const listData = useMemo(() => buildListData(entries), [entries]);

  const goalWeightKg = phaseInfo?.goalWeight ?? null;
  const phaseColor = phaseInfo?.phase ? PHASE_COLOR[phaseInfo.phase] : null;

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        const d = new Date(item.monthKey + '-01T00:00:00Z');
        return (
          <Text style={styles.monthHeader}>
            {d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </Text>
        );
      }
      return (
        <SwipeableEntryRow
          entry={item.entry}
          unit={unit}
          onDelete={() => deleteEntry(item.entry.id)}
        />
      );
    },
    [unit, deleteEntry]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Body Weight</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item, i) =>
          item.type === 'header' ? `h-${item.monthKey}` : `e-${item.entry.id}-${i}`
        }
        renderItem={renderItem}
        onEndReached={loadMoreEntries}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Current stats */}
            <View style={styles.statsHeader}>
              <Text style={styles.currentWeight}>
                {stats?.current != null ? formatWeight(stats.current, unit) : '—'}
              </Text>
              {stats?.sevenDayAvg != null && (
                <Text style={styles.avgWeight}>
                  7d avg: {formatWeight(stats.sevenDayAvg, unit)}
                </Text>
              )}
            </View>

            {/* Phase banner */}
            {phaseInfo ? (
              <View
                style={[
                  styles.phaseBanner,
                  phaseColor && { borderColor: phaseColor, backgroundColor: PHASE_MUTED[phaseInfo.phase] ?? Colors.surface },
                ]}
              >
                <View style={styles.phaseLeft}>
                  <Text style={[styles.phaseLabel, phaseColor && { color: phaseColor }]}>
                    {phaseInfo.phase.toUpperCase()}
                  </Text>
                  <Text style={styles.phaseDate}>
                    Since {phaseInfo.startDate} · {daysElapsed(phaseInfo.startDate)}d
                  </Text>
                  {goalWeightKg != null && (
                    <Text style={styles.phaseGoal}>
                      Goal: {formatWeight(goalWeightKg, unit)}
                      {stats?.current != null
                        ? ` · ${Math.abs(kgToDisplay(Math.abs(stats.current - goalWeightKg), unit))} ${unit} to go`
                        : ''}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.changePhaseBtn}
                  onPress={() => setPhaseSelectorVisible(true)}
                >
                  <Text style={styles.changePhaseText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.noPhaseCard}
                onPress={() => setPhaseSelectorVisible(true)}
              >
                <Text style={styles.noPhaseText}>Set your current phase →</Text>
              </Pressable>
            )}

            {/* Chart */}
            <BodyWeightChart
              rawEntries={filteredEntries}
              movingAverage={filteredMA}
              goalWeightKg={goalWeightKg}
              phaseStartDate={phaseInfo?.startDate ?? null}
              workoutDates={workoutDates}
              unit={unit}
            />

            {/* Time range selector */}
            <View style={styles.rangeRow}>
              {TIME_RANGES.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.rangePill, timeRange === r && styles.rangePillActive]}
                  onPress={() => setTimeRange(r)}
                >
                  <Text style={[styles.rangeText, timeRange === r && styles.rangeTextActive]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              {[
                {
                  label: 'Min',
                  value: stats?.allTimeMin
                    ? `${kgToDisplay(stats.allTimeMin.weight, unit)}`
                    : '—',
                },
                {
                  label: 'Max',
                  value: stats?.allTimeMax
                    ? `${kgToDisplay(stats.allTimeMax.weight, unit)}`
                    : '—',
                },
                {
                  label: 'Change',
                  value:
                    rangeChange != null
                      ? `${rangeChange >= 0 ? '+' : ''}${kgToDisplay(rangeChange, unit)}`
                      : '—',
                },
                { label: 'Entries', value: String(stats?.totalEntries ?? 0) },
              ].map((card) => (
                <View key={card.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
              ))}
            </View>

            {/* Log entry */}
            <View style={styles.logSection}>
              <Text style={styles.logTitle}>LOG WEIGHT</Text>
              {loggedToday && (
                <Text style={styles.loggedToday}>Already logged today — you can still add another</Text>
              )}
              <View style={styles.logInputRow}>
                <TextInput
                  ref={weightInputRef}
                  style={styles.weightInput}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  placeholder={unit === 'kg' ? '0.0' : '0.0'}
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                <Text style={styles.unitLabel}>{unit}</Text>
              </View>
              <TextInput
                style={styles.notesInput}
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Notes (optional)"
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [styles.logBtn, pressed && styles.logBtnPressed]}
                onPress={handleLog}
              >
                <Text style={styles.logBtnText}>Log Weight</Text>
              </Pressable>
            </View>

            {/* History header */}
            <Text style={styles.historyLabel}>HISTORY</Text>
            {entries.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardEmoji}>⚖️</Text>
                <Text style={styles.emptyCardTitle}>No weight entries yet</Text>
                <Text style={styles.emptyCardSub}>Log your first weight above to start tracking</Text>
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
      />

      <PhaseSelector
        visible={phaseSelectorVisible}
        currentPhase={phaseInfo?.phase ?? ''}
        currentGoalWeight={goalWeightKg}
        weightUnit={unit}
        onConfirm={(phase, goalWeight) => setPhase(phase as WorkoutPhase | '', goalWeight)}
        onClose={() => setPhaseSelectorVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  listContent: { paddingBottom: Spacing.xxxl },
  statsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  currentWeight: {
    color: Colors.text,
    fontSize: Typography.size.xxxl,
    fontWeight: Typography.weight.bold,
    letterSpacing: -1,
  },
  avgWeight: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
  },
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  phaseLeft: { flex: 1, gap: 2 },
  phaseLabel: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    letterSpacing: 1,
  },
  phaseDate: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  phaseGoal: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  changePhaseBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changePhaseText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  noPhaseCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  noPhaseText: { color: Colors.textTertiary, fontSize: Typography.size.sm },
  chartContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  chartEmpty: {
    height: CHART_H,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  chartEmptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    textAlign: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  rangePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rangePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rangeText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  rangeTextActive: { color: Colors.background },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.primary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  statLabel: { color: Colors.textTertiary, fontSize: Typography.size.xs },
  logSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  logTitle: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  loggedToday: { color: Colors.textTertiary, fontSize: Typography.size.xs },
  logInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weightInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  unitLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    width: 36,
  },
  notesInput: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.size.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  logBtnPressed: { opacity: 0.85 },
  logBtnText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  historyLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyCardEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  emptyCardTitle: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  emptyCardSub: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  monthHeader: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  swipeWrapper: { overflow: 'hidden' },
  deleteZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_W,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { alignItems: 'center' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  entryDate: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  entryNotes: { color: Colors.textTertiary, fontSize: Typography.size.xs, marginTop: 2 },
  entryWeight: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
