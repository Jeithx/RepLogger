import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import { PRResult } from '../../types';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

interface StatBoxProps {
  label: string;
  value: string;
}

function StatBox({ label, value }: StatBoxProps) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface PRCardProps {
  pr: PRResult;
}

function PRCard({ pr }: PRCardProps) {
  return (
    <View style={styles.prCard}>
      <View style={styles.prRow}>
        <Ionicons name="trophy" size={16} color={Colors.primary} />
        <Text style={styles.prExercise}>{pr.exerciseName}</Text>
      </View>
      <Text style={styles.prDetail}>
        {pr.weightKg}kg × {pr.reps} reps
        {'  ·  '}
        <Text style={styles.prEstimated}>{pr.estimated1rm.toFixed(1)}kg e1RM</Text>
      </Text>
    </View>
  );
}

export default function SummaryScreen() {
  const { summaryData, clearSummary } = useWorkoutStore();

  const handleDone = useCallback(() => {
    clearSummary();
    router.replace('/(tabs)/');
  }, [clearSummary]);

  if (!summaryData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No summary available.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/')} style={styles.doneButton}>
          <Text style={styles.doneButtonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const { durationSeconds, exerciseCount, totalSets, totalVolumeKg, newPRs } = summaryData;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        <View style={styles.titleRow}>
          <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
          <Text style={styles.title}>Workout Complete</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox label="Duration" value={formatDuration(durationSeconds)} />
          <StatBox label="Exercises" value={String(exerciseCount)} />
          <StatBox label="Sets" value={String(totalSets)} />
          <StatBox label="Volume" value={formatVolume(totalVolumeKg)} />
        </View>

        {/* New PRs */}
        {newPRs.length > 0 && (
          <View style={styles.prSection}>
            <Text style={styles.prSectionTitle}>New Personal Records</Text>
            {newPRs.map((pr, i) => (
              <PRCard key={`${pr.exerciseName}-${i}`} pr={pr} />
            ))}
          </View>
        )}

        {totalSets === 0 && (
          <Text style={styles.noSetsText}>No completed sets were recorded.</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
          onPress={handleDone}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxxl,
    gap: Spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prSection: {
    gap: Spacing.sm,
  },
  prSectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  prCard: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: Spacing.xs,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  prExercise: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  prDetail: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  prEstimated: {
    color: Colors.primary,
    fontWeight: Typography.weight.semibold,
  },
  noSetsText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  doneButtonPressed: {
    opacity: 0.85,
  },
  doneButtonText: {
    color: Colors.background,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  errorText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xxxl,
    marginBottom: Spacing.lg,
  },
});
