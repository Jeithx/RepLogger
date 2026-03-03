import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRoutineStore } from '../../store/useRoutineStore';
import {
  getRoutineWithDaysById,
  updateRoutine,
} from '../../db/routineQueries';
import { RoutineWithDays } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routineId = parseInt(id ?? '0', 10);

  const { activeRoutineId, setActiveRoutine, deleteRoutine } = useRoutineStore();
  const [routine, setRoutine] = useState<RoutineWithDays | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const reload = useCallback(() => {
    const r = getRoutineWithDaysById(routineId);
    setRoutine(r);
    if (r && !editingName) setNameValue(r.name);
  }, [routineId, editingName]);

  useFocusEffect(reload);

  if (!routine) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.notFound}>Routine not found</Text>
      </View>
    );
  }

  const isActive = routine.id === activeRoutineId;

  const handleNameCommit = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== routine.name) {
      updateRoutine(routineId, trimmed);
      setRoutine((r) => (r ? { ...r, name: trimmed } : r));
    }
    setEditingName(false);
  };

  const handleSetActive = () => {
    setActiveRoutine(isActive ? null : routine.id);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Routine',
      `Delete "${routine.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRoutine(routineId);
            router.replace('/(tabs)/routines');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>

        {editingName ? (
          <TextInput
            style={styles.nameInput}
            value={nameValue}
            onChangeText={setNameValue}
            onBlur={handleNameCommit}
            onSubmitEditing={handleNameCommit}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <Pressable style={styles.namePressable} onPress={() => setEditingName(true)}>
            <Text style={styles.routineName}>{routine.name}</Text>
            <Ionicons name="pencil-outline" size={16} color={Colors.textTertiary} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Set as active */}
        <Pressable
          style={({ pressed }) => [
            styles.activeBtn,
            isActive && styles.activeBtnActive,
            pressed && styles.activeBtnPressed,
          ]}
          onPress={handleSetActive}
        >
          <Ionicons
            name={isActive ? 'checkmark-circle' : 'radio-button-off-outline'}
            size={20}
            color={isActive ? Colors.background : Colors.primary}
          />
          <Text style={[styles.activeBtnText, isActive && styles.activeBtnTextActive]}>
            {isActive ? 'Active Routine ✓' : 'Set as Active'}
          </Text>
        </Pressable>

        {/* Days */}
        <Text style={styles.sectionLabel}>Training Days</Text>

        {routine.days.length === 0 && (
          <Text style={styles.emptyText}>No days added yet</Text>
        )}

        {routine.days.map((day) => {
          const isRest = day.exercises.length === 0;
          return (
            <Pressable
              key={day.id}
              style={({ pressed }) => [styles.dayCard, pressed && styles.dayCardPressed]}
              onPress={() =>
                router.push(
                  `/routines/day-editor?routineDayId=${day.id}&dayName=${encodeURIComponent(day.name)}`
                )
              }
            >
              <View style={styles.dayInfo}>
                <View style={styles.dayOrderBadge}>
                  <Text style={styles.dayOrderText}>{day.day_order}</Text>
                </View>
                <View style={styles.dayTextBlock}>
                  <Text style={styles.dayName}>{day.name}</Text>
                  <Text style={styles.dayMeta}>
                    {isRest ? 'Rest day' : `${day.exercises.length} exercises`}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          );
        })}

        {/* Delete */}
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteBtnText}>Delete Routine</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  backBtn: { padding: Spacing.lg },
  notFound: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xxxl,
  },
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
  nameInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  namePressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  routineName: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  activeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.primaryMuted,
  },
  activeBtnActive: {
    backgroundColor: Colors.primary,
  },
  activeBtnPressed: { opacity: 0.85 },
  activeBtnText: {
    color: Colors.primary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  activeBtnTextActive: { color: Colors.background },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayCardPressed: { opacity: 0.8 },
  dayInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  dayOrderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOrderText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  dayTextBlock: { flex: 1, gap: 2 },
  dayName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  dayMeta: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  deleteBtnPressed: { backgroundColor: `${Colors.error}15` },
  deleteBtnText: {
    color: Colors.error,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
});
