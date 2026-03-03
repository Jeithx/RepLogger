import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoutineDayExercisesWithNames,
  addExerciseToDay,
  removeExerciseFromDay,
  reorderExercisesInDay,
} from '../../db/routineQueries';
import ExercisePicker from '../../components/ExercisePicker';
import { RoutineDayExerciseWithName } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

// ─── Inline exercise config form ───────────────────────────────────────────

interface ExerciseConfigModalProps {
  visible: boolean;
  exerciseId: number;
  exerciseName: string;
  onConfirm: (sets: number, reps: number, weight: number) => void;
  onClose: () => void;
}

function ExerciseConfigModal({
  visible,
  exerciseName,
  onConfirm,
  onClose,
}: ExerciseConfigModalProps) {
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('0');

  const handleConfirm = () => {
    const s = parseInt(sets, 10) || 3;
    const r = parseInt(reps, 10) || 10;
    const w = parseFloat(weight.replace(',', '.')) || 0;
    onConfirm(s, r, w);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.configBackdrop} onPress={onClose} />
      <View style={styles.configSheet}>
        <Text style={styles.configTitle}>{exerciseName}</Text>
        <View style={styles.configRow}>
          <View style={styles.configField}>
            <Text style={styles.configLabel}>Sets</Text>
            <TextInput
              style={styles.configInput}
              value={sets}
              onChangeText={setSets}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.configField}>
            <Text style={styles.configLabel}>Reps</Text>
            <TextInput
              style={styles.configInput}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.configField}>
            <Text style={styles.configLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.configInput}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed]}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmBtnText}>Add Exercise</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Exercise Row ──────────────────────────────────────────────────────────

interface ExerciseRowProps {
  item: RoutineDayExerciseWithName;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function ExerciseRow({ item, index, total, onMoveUp, onMoveDown, onDelete }: ExerciseRowProps) {
  return (
    <View style={styles.exRow}>
      <View style={styles.exInfo}>
        <Text style={styles.exName}>{item.exercise_name}</Text>
        <Text style={styles.exMeta}>
          {item.target_sets}×{item.target_reps}
          {item.target_weight > 0 ? ` @ ${item.target_weight}kg` : ''}
        </Text>
      </View>
      <View style={styles.reorderBtns}>
        <Pressable
          onPress={onMoveUp}
          disabled={index === 0}
          hitSlop={6}
          style={({ pressed }) => [styles.reorderBtn, pressed && styles.reorderBtnPressed]}
        >
          <Ionicons
            name="chevron-up"
            size={18}
            color={index === 0 ? Colors.textTertiary : Colors.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={onMoveDown}
          disabled={index === total - 1}
          hitSlop={6}
          style={({ pressed }) => [styles.reorderBtn, pressed && styles.reorderBtnPressed]}
        >
          <Ionicons
            name="chevron-down"
            size={18}
            color={index === total - 1 ? Colors.textTertiary : Colors.textSecondary}
          />
        </Pressable>
      </View>
      <Pressable
        onPress={() =>
          Alert.alert('Remove exercise?', item.exercise_name, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: onDelete },
          ])
        }
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ─── Day Editor Screen ─────────────────────────────────────────────────────

export default function DayEditorScreen() {
  const { routineDayId, dayName } = useLocalSearchParams<{
    routineDayId: string;
    dayName: string;
  }>();
  const dayId = parseInt(routineDayId ?? '0', 10);

  const [exercises, setExercises] = useState<RoutineDayExerciseWithName[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingExercise, setPendingExercise] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const reload = useCallback(() => {
    if (dayId) setExercises(getRoutineDayExercisesWithNames(dayId));
  }, [dayId]);

  useFocusEffect(reload);

  const handleExerciseSelected = (exerciseId: number, exerciseName: string) => {
    setPendingExercise({ id: exerciseId, name: exerciseName });
  };

  const handleConfigConfirm = (sets: number, reps: number, weight: number) => {
    if (!pendingExercise) return;
    const orderIndex = exercises.length;
    addExerciseToDay(dayId, pendingExercise.id, orderIndex, sets, reps, weight);
    setPendingExercise(null);
    reload();
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...exercises];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    setExercises(reordered);
    reorderExercisesInDay(
      dayId,
      reordered.map((e) => e.exercise_id)
    );
  };

  const handleMoveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    const reordered = [...exercises];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    setExercises(reordered);
    reorderExercisesInDay(
      dayId,
      reordered.map((e) => e.exercise_id)
    );
  };

  const handleDelete = (exerciseId: number) => {
    removeExerciseFromDay(dayId, exerciseId);
    reload();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{dayName ?? 'Edit Day'}</Text>
        <Pressable
          style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {exercises.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exercises yet</Text>
            <Text style={styles.emptyHint}>Tap "+ Add Exercise" below</Text>
          </View>
        )}

        {exercises.map((ex, idx) => (
          <ExerciseRow
            key={`${ex.exercise_id}-${idx}`}
            item={ex}
            index={idx}
            total={exercises.length}
            onMoveUp={() => handleMoveUp(idx)}
            onMoveDown={() => handleMoveDown(idx)}
            onDelete={() => handleDelete(ex.exercise_id)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.addExBtn, pressed && styles.addExBtnPressed]}
          onPress={() => setPickerVisible(true)}
        >
          <Ionicons name="add" size={20} color={Colors.background} />
          <Text style={styles.addExText}>Add Exercise</Text>
        </Pressable>
      </View>

      <ExercisePicker
        visible={pickerVisible}
        onSelect={(id, name) => {
          setPickerVisible(false);
          handleExerciseSelected(id, name);
        }}
        onClose={() => setPickerVisible(false)}
      />

      {pendingExercise && (
        <ExerciseConfigModal
          visible
          exerciseId={pendingExercise.id}
          exerciseName={pendingExercise.name}
          onConfirm={handleConfigConfirm}
          onClose={() => setPendingExercise(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  doneBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  doneBtnPressed: { opacity: 0.85 },
  doneBtnText: {
    color: Colors.background,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
    gap: Spacing.xs,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  emptyHint: { color: Colors.textTertiary, fontSize: Typography.size.sm },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  exInfo: { flex: 1, gap: 2 },
  exName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  exMeta: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  reorderBtns: { flexDirection: 'column', gap: 2 },
  reorderBtn: { padding: 2 },
  reorderBtnPressed: { opacity: 0.6 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  addExBtnPressed: { opacity: 0.85 },
  addExText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  configBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  configSheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  configTitle: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  configRow: { flexDirection: 'row', gap: Spacing.md },
  configField: { flex: 1, gap: Spacing.xs },
  configLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  configInput: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmBtnPressed: { opacity: 0.85 },
  confirmBtnText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
