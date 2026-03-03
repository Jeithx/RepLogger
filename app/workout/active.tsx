import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { getLastPerformance } from '../../db/workoutQueries';
import ExercisePicker from '../../components/ExercisePicker';
import RestTimer from '../../components/RestTimer';
import { ActiveExercise, ActiveSet, LastPerformanceSet } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

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
  onToggle: () => void;
  onDelete: () => void;
}

function SetRow({ exerciseId, set, onToggle, onDelete }: SetRowProps) {
  const updateSet = useWorkoutStore((s) => s.updateSet);

  return (
    <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
      <Text style={styles.setNumber}>{set.setNumber}</Text>

      <TextInput
        style={[styles.setInput, set.completed && styles.setInputCompleted]}
        value={set.weight}
        onChangeText={(v) => updateSet(exerciseId, set.setNumber, 'weight', v)}
        keyboardType="decimal-pad"
        placeholder="kg"
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
        style={[styles.checkButton, set.completed && styles.checkButtonDone]}
        onPress={onToggle}
        hitSlop={8}
      >
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={28}
          color={set.completed ? Colors.primary : Colors.textTertiary}
        />
      </Pressable>

      <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteSetBtn}>
        <Ionicons name="close" size={16} color={Colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ─── Exercise Block ────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  exercise: ActiveExercise;
  onSetCompleted: () => void;
}

function ExerciseBlock({ exercise, onSetCompleted }: ExerciseBlockProps) {
  const { toggleSetComplete, addSet, removeSet, removeExercise } = useWorkoutStore();
  const [lastPerf, setLastPerf] = useState<LastPerformanceSet[]>([]);

  useEffect(() => {
    const perf = getLastPerformance(exercise.exerciseId);
    setLastPerf(perf);
  }, [exercise.exerciseId]);

  const handleToggle = useCallback(
    (setNumber: number, wasCompleted: boolean) => {
      toggleSetComplete(exercise.exerciseId, setNumber);
      if (!wasCompleted) onSetCompleted();
    },
    [exercise.exerciseId, toggleSetComplete, onSetCompleted]
  );

  const lastPerfText =
    lastPerf.length > 0
      ? `Last: ${lastPerf.map((s) => `${s.weight_kg}kg×${s.reps}`).join(', ')}`
      : null;

  return (
    <View style={styles.exerciseBlock}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
        <Pressable
          onPress={() => removeExercise(exercise.exerciseId)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
        </Pressable>
      </View>

      {lastPerfText && (
        <Text style={styles.lastPerf}>{lastPerfText}</Text>
      )}

      <View style={styles.setHeader}>
        <Text style={styles.setHeaderText}>SET</Text>
        <Text style={[styles.setHeaderText, styles.setHeaderCenter]}>KG</Text>
        <Text style={[styles.setHeaderText, styles.setHeaderCenter]}>REPS</Text>
        <View style={{ width: 36 }} />
        <View style={{ width: 24 }} />
      </View>

      {exercise.sets.map((s) => (
        <SetRow
          key={s.setNumber}
          exerciseId={exercise.exerciseId}
          set={s}
          onToggle={() => handleToggle(s.setNumber, s.completed)}
          onDelete={() => {
            if (exercise.sets.length <= 1) return;
            removeSet(exercise.exerciseId, s.setNumber);
          }}
        />
      ))}

      <Pressable
        style={({ pressed }) => [styles.addSetBtn, pressed && styles.addSetBtnPressed]}
        onPress={() => addSet(exercise.exerciseId)}
      >
        <Ionicons name="add" size={16} color={Colors.primary} />
        <Text style={styles.addSetText}>Add Set</Text>
      </Pressable>
    </View>
  );
}

// ─── Active Workout Screen ─────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const { activeWorkout, elapsedSeconds, finishWorkout, discardWorkout, summaryData } =
    useWorkoutStore();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [restTimerVisible, setRestTimerVisible] = useState(false);

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
    Alert.alert('Finish Workout?', 'Completed sets will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => finishWorkout(),
      },
    ]);
  }, [finishWorkout]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Workout?', 'All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardWorkout();
          router.replace('/(tabs)/');
        },
      },
    ]);
  }, [discardWorkout]);

  if (!activeWorkout) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleDiscard} style={styles.headerBtn}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>

        <Text style={styles.elapsed}>{formatElapsed(elapsedSeconds)}</Text>

        <Pressable
          style={({ pressed }) => [styles.finishBtn, pressed && styles.finishBtnPressed]}
          onPress={handleFinish}
        >
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
      </View>

      {/* Exercise list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeWorkout.exercises.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No exercises yet</Text>
            <Text style={styles.emptySubtitle}>Tap "+ Add Exercise" to get started</Text>
          </View>
        )}

        {activeWorkout.exercises.map((ex) => (
          <ExerciseBlock
            key={ex.exerciseId}
            exercise={ex}
            onSetCompleted={() => setRestTimerVisible(true)}
          />
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating add exercise button */}
      <View style={styles.fab}>
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
        durationSeconds={90}
        onDismiss={() => setRestTimerVisible(false)}
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
    minWidth: 72,
    alignItems: 'center',
  },
  finishBtnPressed: {
    opacity: 0.8,
  },
  finishText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  lastPerf: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    paddingTop: Spacing.xs,
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
  },
  setRowCompleted: {
    opacity: 0.55,
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
  },
  checkButtonDone: {},
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
});
