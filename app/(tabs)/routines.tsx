import { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRoutineStore } from '../../store/useRoutineStore';
import { RoutineWithDays } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

interface RoutineCardProps {
  routine: RoutineWithDays;
  isActive: boolean;
  onDelete: () => void;
}

function RoutineCard({ routine, isActive, onDelete }: RoutineCardProps) {
  const exerciseCount = routine.days.reduce((sum, d) => sum + d.exercises.length, 0);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && styles.cardActive,
        pressed && styles.cardPressed,
      ]}
      onPress={() => router.push(`/routines/${routine.id}`)}
      onLongPress={() => {
        Alert.alert(
          'Delete Routine',
          `Delete "${routine.name}"? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ]
        );
      }}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{routine.name}</Text>
          <Text style={styles.cardMeta}>
            {routine.days_per_week} days · {exerciseCount} exercises
          </Text>
        </View>
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
      </View>
    </Pressable>
  );
}

export default function RoutinesScreen() {
  const { routines, activeRoutineId, deleteRoutine, loadRoutines } = useRoutineStore();

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [loadRoutines])
  );

  const handleDelete = useCallback(
    (id: number) => {
      deleteRoutine(id);
    },
    [deleteRoutine]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Routines</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/routines/builder')}
        >
          <Ionicons name="add" size={22} color={Colors.background} />
        </Pressable>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RoutineCard
            routine={item}
            isActive={item.id === activeRoutineId}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏋️</Text>
            <Text style={styles.emptyTitle}>No routines yet</Text>
            <Text style={styles.emptySub}>Create a routine to structure your training</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
              onPress={() => router.push('/routines/builder')}
            >
              <Text style={styles.emptyButtonText}>Create your first routine</Text>
            </Pressable>
          </View>
        }
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
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActive: {
    borderColor: Colors.primary,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  cardMeta: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  activeBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  activeBadgeText: {
    color: Colors.primary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl * 2,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  emptySub: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyButtonPressed: {
    opacity: 0.85,
  },
  emptyButtonText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
