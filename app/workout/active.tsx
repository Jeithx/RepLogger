import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { getLastPerformance } from '../../db/workoutQueries';
import { getSetting } from '../../db/settingsQueries';
import { getDatabase } from '../../db/database';
import { kgToDisplay, WeightUnit } from '../../utils/weightUtils';
import ExercisePicker from '../../components/ExercisePicker';
import RestTimer from '../../components/RestTimer';
import { ActiveExercise, ActiveSet, LastPerformanceSet } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import { showWorkoutActiveNotification, dismissWorkoutActiveNotification } from '../../utils/notificationService';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Set Row ──────────────────────────────────────────────────────────────

interface SetRowProps {
  exerciseId: number;
  set: ActiveSet;
  unit: WeightUnit;
  weightPlaceholder: string;
  onToggle: () => void;
  onDelete: () => void;
}

const SetRow = memo(function SetRow({
  exerciseId,
  set,
  unit,
  weightPlaceholder,
  onToggle,
  onDelete,
}: SetRowProps) {
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const reduceMotion = useReducedMotion();

  const scale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  const checkScale = useSharedValue(set.completed ? 1 : 0);
  const prevCompleted = useRef(set.completed);

  useEffect(() => {
    if (!prevCompleted.current && set.completed && !reduceMotion) {
      scale.value = withSequence(withSpring(0.97, { damping: 15 }), withSpring(1, { damping: 15 }));
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 300 })
      );
      checkScale.value = withSequence(withSpring(1.2, { damping: 10 }), withSpring(1, { damping: 12 }));
    } else if (set.completed && prevCompleted.current !== set.completed) {
      checkScale.value = 1;
    } else if (!set.completed) {
      checkScale.value = withSpring(0, { damping: 15 });
    }
    prevCompleted.current = set.completed;
  }, [set.completed]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={[styles.setRow, set.completed && styles.setRowCompleted, rowStyle]}>
      {/* Flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
        pointerEvents="none"
      />

      <Text style={styles.setNumber}>{set.setNumber}</Text>

      <TextInput
        style={[styles.setInput, set.completed && styles.setInputCompleted]}
        value={set.weight}
        onChangeText={(v) => updateSet(exerciseId, set.setNumber, 'weight', v)}
        keyboardType="decimal-pad"
        placeholder={weightPlaceholder}
        placeholderTextColor={Colors.textTertiary}
        editable={!set.completed}
        selectTextOnFocus
      />

      <TextInput
        style={[styles.setInput, set.completed && styles.setInputCompleted]}
        value={set.reps}
        onChangeText={(v) => updateSet(exerciseId, set.setNumber, 'reps', v)}
        keyboardType="number-pad"
        placeholder="reps"
        placeholderTextColor={Colors.textTertiary}
        editable={!set.completed}
        selectTextOnFocus
      />

      <Pressable
        style={styles.checkButton}
        onPress={onToggle}
        hitSlop={8}
      >
        <View style={[styles.checkRing, set.completed && styles.checkRingComplete]}>
          <Animated.View style={checkStyle}>
            {set.completed && (
              <Ionicons name="checkmark" size={16} color={Colors.background} />
            )}
          </Animated.View>
        </View>
      </Pressable>

      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteSetBtn}>
        <Ionicons name="close" size={16} color={Colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
});

// ─── Exercise Block ────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  exercise: ActiveExercise;
  unit: WeightUnit;
  drag: () => void;
  isActive: boolean;
  onSetCompleted: () => void;
}

const ExerciseBlock = memo(function ExerciseBlock({
  exercise,
  unit,
  drag,
  isActive,
  onSetCompleted,
}: ExerciseBlockProps) {
  const { toggleSetComplete, addSet, removeSet, removeExercise } = useWorkoutStore();
  const [lastPerf, setLastPerf] = useState<LastPerformanceSet[]>([]);
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);

  useEffect(() => {
    setLastPerf(getLastPerformance(exercise.exerciseId));
    const db = getDatabase();
    const result = db.getFirstSync<{ muscle_group: string }>(
      'SELECT muscle_group FROM exercises WHERE id = ?',
      [exercise.exerciseId]
    );
    setMuscleGroup(result?.muscle_group ?? null);
  }, [exercise.exerciseId]);

  const handleToggle = useCallback(
    (setNumber: number, wasCompleted: boolean) => {
      toggleSetComplete(exercise.exerciseId, setNumber);
      if (!wasCompleted) {
        onSetCompleted();
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      }
    },
    [exercise.exerciseId, toggleSetComplete, onSetCompleted]
  );

  const lastPerfText =
    lastPerf.length > 0
      ? `Last: ${lastPerf.map((s) => `${kgToDisplay(s.weight_kg, unit)}${unit}×${s.reps}`).join(', ')}`
      : null;

  return (
    <View style={[styles.exerciseBlock, isActive && styles.exerciseBlockActive]}>
      <Pressable
        onLongPress={drag}
        delayLongPress={200}
        style={styles.exerciseHeader}
      >
        <Ionicons name="reorder-three-outline" size={20} color={Colors.textTertiary} style={styles.dragHandle} />
        <View style={styles.exerciseNameRow}>
          <Text style={styles.exerciseName} numberOfLines={1}>{exercise.exerciseName}</Text>
          {muscleGroup && (
            <View style={styles.muscleBadge}>
              <Text style={styles.muscleBadgeText}>{muscleGroup}</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => removeExercise(exercise.exerciseId)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
        </Pressable>
      </Pressable>

      {lastPerfText && (
        <Text style={styles.lastPerf}>{lastPerfText}</Text>
      )}

      <View style={styles.setHeader}>
        <Text style={styles.setHeaderText}>SET</Text>
        <Text style={[styles.setHeaderText, styles.setHeaderCenter]}>{unit.toUpperCase()}</Text>
        <Text style={[styles.setHeaderText, styles.setHeaderCenter]}>REPS</Text>
        <View style={{ width: 36 }} />
        <View style={{ width: 24 }} />
      </View>

      {exercise.sets.map((s) => {
        const lp = lastPerf.find((l) => l.set_number === s.setNumber);
        const weightPlaceholder = lp ? String(kgToDisplay(lp.weight_kg, unit)) : unit;
        return (
          <SetRow
            key={s.setNumber}
            exerciseId={exercise.exerciseId}
            set={s}
            unit={unit}
            weightPlaceholder={weightPlaceholder}
            onToggle={() => handleToggle(s.setNumber, s.completed)}
            onDelete={() => {
              if (exercise.sets.length <= 1) return;
              removeSet(exercise.exerciseId, s.setNumber);
            }}
          />
        );
      })}

      <Pressable
        style={({ pressed }) => [styles.addSetBtn, pressed && styles.addSetBtnPressed]}
        onPress={() => addSet(exercise.exerciseId)}
      >
        <Ionicons name="add" size={16} color={Colors.primary} />
        <Text style={styles.addSetText}>Add Set</Text>
      </Pressable>
    </View>
  );
});

// ─── Discard Sheet ─────────────────────────────────────────────────────────

interface DiscardSheetProps {
  visible: boolean;
  completedSets: number;
  onKeep: () => void;
  onDiscard: () => void;
}

function DiscardSheet({ visible, completedSets, onKeep, onDiscard }: DiscardSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onKeep}>
      <Pressable style={styles.sheetBackdrop} onPress={onKeep} />
      <View style={styles.sheet}>
        <Text style={styles.sheetEmoji}>⚠️</Text>
        <Text style={styles.sheetTitle}>Discard Workout?</Text>
        <Text style={styles.sheetSub}>
          {completedSets > 0
            ? `${completedSets} completed set${completedSets !== 1 ? 's' : ''} will be lost.`
            : 'All progress will be lost.'}
        </Text>
        <View style={styles.sheetButtons}>
          <Pressable
            style={({ pressed }) => [styles.keepBtn, pressed && { opacity: 0.85 }]}
            onPress={onKeep}
          >
            <Text style={styles.keepBtnText}>Keep Going</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.discardBtn, pressed && { opacity: 0.85 }]}
            onPress={onDiscard}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Active Workout Screen ─────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const { activeWorkout, elapsedSeconds, workoutStartTime, finishWorkout, discardWorkout, summaryData, reorderExercises } =
    useWorkoutStore();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [restSeconds, setRestSeconds] = useState(90);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const savedUnit = getSetting('weight_unit');
    const savedRest = getSetting('rest_timer_seconds');
    setUnit(savedUnit === 'lbs' ? 'lbs' : 'kg');
    setRestSeconds(savedRest ? parseInt(savedRest, 10) : 90);
  }, []);

  // Show persistent notification when app is backgrounded during a workout
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (!activeWorkout) return;

      if (prev === 'active' && nextState !== 'active') {
        const startTs = workoutStartTime ?? Date.now();
        showWorkoutActiveNotification(startTs).catch(() => { });
      } else if (prev !== 'active' && nextState === 'active') {
        dismissWorkoutActiveNotification().catch(() => { });
      }
    });

    return () => subscription.remove();
  }, [activeWorkout, workoutStartTime]);

  // Dismiss notification when workout is finished/discarded
  useEffect(() => {
    if (!activeWorkout) {
      dismissWorkoutActiveNotification().catch(() => { });
    }
  }, [activeWorkout]);

  useEffect(() => {
    if (summaryData) {
      router.replace('/workout/summary');
    }
  }, [summaryData]);

  useEffect(() => {
    if (!activeWorkout) {
      router.replace('/(tabs)/');
    }
  }, [activeWorkout]);

  const handleFinish = useCallback(() => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    finishWorkout();
  }, [finishWorkout]);

  const handleDiscard = useCallback(() => {
    discardWorkout();
    router.replace('/(tabs)/');
  }, [discardWorkout]);

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ActiveExercise>) => (
      <ScaleDecorator>
        <ExerciseBlock
          exercise={item}
          unit={unit}
          drag={drag}
          isActive={isActive}
          onSetCompleted={() => setRestTimerVisible(true)}
        />
      </ScaleDecorator>
    ),
    [unit]
  );

  if (!activeWorkout) return null;

  const completedCount = activeWorkout.exercises
    .flatMap((e) => e.sets)
    .filter((s) => s.completed).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Spacing.md + insets.top }]}>
        <Pressable onPress={() => setDiscardVisible(true)} style={styles.headerBtn}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>

        <Text style={styles.elapsed}>{formatElapsed(elapsedSeconds)}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.finishBtn,
            completedCount === 0 && styles.finishBtnDisabled,
            pressed && completedCount > 0 && styles.finishBtnPressed,
          ]}
          onPress={completedCount > 0 ? handleFinish : undefined}
          disabled={completedCount === 0}
        >
          <Text style={styles.finishText}>
            {completedCount > 0 ? `Finish (${completedCount})` : 'Finish'}
          </Text>
        </Pressable>
      </View>

      {/* Exercise list */}
      <DraggableFlatList
        data={activeWorkout.exercises}
        keyExtractor={(item) => String(item.exerciseId)}
        renderItem={renderItem}
        onDragEnd={({ data }) => reorderExercises(data)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Add Exercise" to get started</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 120 + insets.bottom }} />}
      />

      {/* FAB */}
      <View style={[styles.fab, { bottom: Spacing.lg + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.fabButton, pressed && styles.fabButtonPressed]}
          onPress={() => setPickerVisible(true)}
        >
          <Ionicons name="add" size={20} color={Colors.background} />
          <Text style={styles.fabText}>Add Exercise</Text>
        </Pressable>
      </View>

      <ExercisePicker
        visible={pickerVisible}
        onSelect={(id, name) => {
          useWorkoutStore.getState().addExercise(id, name);
        }}
        onClose={() => setPickerVisible(false)}
      />

      <RestTimer
        visible={restTimerVisible}
        durationSeconds={restSeconds}
        onDismiss={() => setRestTimerVisible(false)}
      />

      <DiscardSheet
        visible={discardVisible}
        completedSets={completedCount}
        onKeep={() => setDiscardVisible(false)}
        onDiscard={handleDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  headerBtn: {
    minWidth: 72,
  },
  elapsed: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  discardText: {
    color: Colors.error,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  finishBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    minWidth: 88,
    alignItems: 'center',
  },
  finishBtnDisabled: {
    backgroundColor: Colors.surfaceElevated,
  },
  finishBtnPressed: {
    opacity: 0.8,
  },
  finishText: {
    color: Colors.background,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  listContent: {
    paddingTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
  },
  exerciseBlock: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseBlockActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  dragHandle: {
    marginRight: 2,
  },
  exerciseNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    flexShrink: 1,
  },
  muscleBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    flexShrink: 0,
  },
  muscleBadgeText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  lastPerf: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
  },
  setHeaderText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    width: 36,
  },
  setHeaderCenter: {
    flex: 1,
    textAlign: 'center',
    width: 'auto',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  setRowCompleted: {
    opacity: 0.6,
  },
  flashOverlay: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: 0,
    zIndex: 1,
  },
  setNumber: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    width: 24,
    textAlign: 'center',
  },
  setInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    textAlign: 'center',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setInputCompleted: {
    borderColor: 'transparent',
  },
  checkButton: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRingComplete: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  deleteSetBtn: {
    width: 24,
    alignItems: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  addSetBtnPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  addSetText: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  fabButtonPressed: {
    opacity: 0.85,
  },
  fabText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  // Discard sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetEmoji: { fontSize: 32 },
  sheetTitle: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  sheetSub: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    textAlign: 'center',
  },
  sheetButtons: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  keepBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  keepBtnText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  discardBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  discardBtnText: {
    color: Colors.error,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
