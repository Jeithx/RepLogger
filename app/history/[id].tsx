import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHistoryStore } from '../../store/useHistoryStore';
import { WorkoutDetailExercise } from '../../types';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

function findMostVolumeExercise(exercises: WorkoutDetailExercise[]): WorkoutDetailExercise | null {
  if (exercises.length === 0) return null;
  return exercises.reduce((best, ex) => (ex.totalVolume > best.totalVolume ? ex : best));
}

function findHeaviestSet(
  exercises: WorkoutDetailExercise[]
): { exerciseName: string; weightKg: number; reps: number } | null {
  let heaviest: { exerciseName: string; weightKg: number; reps: number } | null = null;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!heaviest || s.weightKg > heaviest.weightKg) {
        heaviest = { exerciseName: ex.exerciseName, weightKg: s.weightKg, reps: s.reps };
      }
    }
  }
  return heaviest;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = parseInt(id ?? '0', 10);

  const loadWorkoutDetail = useHistoryStore((s) => s.loadWorkoutDetail);
  const clearSelectedWorkout = useHistoryStore((s) => s.clearSelectedWorkout);
  const workout = useHistoryStore((s) => s.selectedWorkout);

  useEffect(() => {
    loadWorkoutDetail(workoutId);
    return () => clearSelectedWorkout();
  }, [workoutId, loadWorkoutDetail, clearSelectedWorkout]);

  if (!workout) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.notFound}>Workout not found</Text>
      </View>
    );
  }

  const mostVolume = findMostVolumeExercise(workout.exercises);
  const heaviestSet = findHeaviestSet(workout.exercises);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>{formatDate(workout.startedAt)}</Text>
          {workout.routineDayName && (
            <Text style={styles.headerDay}>{workout.routineDayName}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatDuration(workout.durationSeconds)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{workout.exercises.length}</Text>
            <Text style={styles.statLabel}>Exercises</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>
              {workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)}
            </Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{formatVolume(workout.totalVolume)}</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        </View>

        {/* Exercises */}
        <Text style={styles.sectionLabel}>EXERCISES</Text>

        {workout.exercises.map((ex) => (
          <View key={ex.exerciseId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
              <Text style={styles.exerciseVolume}>{formatVolume(ex.totalVolume)}</Text>
            </View>
            <View style={styles.setHeaderRow}>
              <Text style={styles.setHeaderCell}>SET</Text>
              <Text style={styles.setHeaderCell}>WEIGHT</Text>
              <Text style={styles.setHeaderCell}>REPS</Text>
              <Text style={styles.setHeaderCell}>VOL</Text>
            </View>
            {ex.sets.map((s) => (
              <View key={s.setNumber} style={styles.setRow}>
                <Text style={styles.setCell}>{s.setNumber}</Text>
                <Text style={styles.setCell}>{s.weightKg}kg</Text>
                <Text style={styles.setCell}>{s.reps}</Text>
                <Text style={styles.setCell}>{Math.round(s.volume)}kg</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Stats section */}
        <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>

        <View style={styles.highlightCard}>
          {mostVolume && (
            <View style={styles.highlightRow}>
              <Ionicons name="flame-outline" size={16} color={Colors.textSecondary} />
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightLabel}>Most Volume</Text>
                <Text style={styles.highlightValue}>
                  {mostVolume.exerciseName} · {formatVolume(mostVolume.totalVolume)}
                </Text>
              </View>
            </View>
          )}
          {heaviestSet && (
            <View style={[styles.highlightRow, mostVolume && styles.highlightRowBorder]}>
              <Ionicons name="barbell-outline" size={16} color={Colors.textSecondary} />
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightLabel}>Heaviest Set</Text>
                <Text style={styles.highlightValue}>
                  {heaviestSet.exerciseName} · {heaviestSet.weightKg}kg × {heaviestSet.reps}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Session PRs */}
        {workout.sessionPRs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>
            {workout.sessionPRs.map((pr) => (
              <View key={pr.id} style={styles.prRow}>
                <Ionicons name="trophy" size={16} color={Colors.primary} />
                <View style={styles.prInfo}>
                  <Text style={styles.prName}>{pr.exerciseName}</Text>
                  <Text style={styles.prDetail}>
                    {pr.weight_kg}kg × {pr.reps} reps · ~{Math.round(pr.estimated_1rm)}kg 1RM
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
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
    fontSize: Typography.size.md,
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
  headerInfo: { flex: 1, gap: 2 },
  headerDate: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  headerDay: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 2,
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  statLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    flex: 1,
  },
  exerciseVolume: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  setHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  setHeaderCell: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  setCell: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  highlightCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  highlightRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  highlightInfo: { flex: 1, gap: 2 },
  highlightLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightValue: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  prInfo: { flex: 1, gap: 2 },
  prName: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  prDetail: { color: Colors.textSecondary, fontSize: Typography.size.xs },
});
