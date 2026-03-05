import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useHistoryStore } from '../store/useHistoryStore';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}

export default function StatsOverview() {
  const stats = useHistoryStore((s) => s.stats);
  const loadStats = useHistoryStore((s) => s.loadStats);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const cards = [
    { label: 'This Week', value: String(stats.thisWeekCount), unit: 'workouts' },
    { label: 'This Month', value: formatVolume(stats.thisMonthVolume), unit: 'kg volume' },
    { label: 'Streak', value: String(stats.streakWeeks), unit: 'weeks' },
    { label: 'All Time', value: String(stats.totalWorkouts), unit: 'workouts' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {cards.map((card) => (
        <View key={card.label} style={styles.card}>
          <Text style={styles.cardLabel}>{card.label}</Text>
          <Text style={styles.cardValue}>{card.value}</Text>
          <Text style={styles.cardUnit}>{card.unit}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
    gap: 2,
  },
  cardLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    color: Colors.primary,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
  },
  cardUnit: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
  },
});
