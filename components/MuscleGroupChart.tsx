import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getMuscleGroupVolume } from '../db/historyQueries';
import { MuscleGroupVolume } from '../types';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}

export default function MuscleGroupChart() {
  const [data, setData] = useState<MuscleGroupVolume[]>([]);

  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      const start = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      setData(getMuscleGroupVolume(start, end));
    }, [])
  );

  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No training data in the last 30 days</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MUSCLE FOCUS · LAST 30 DAYS</Text>
      <View style={styles.chart}>
        {data.map((item) => (
          <View key={item.muscleGroup} style={styles.row}>
            <Text style={styles.groupLabel} numberOfLines={1}>
              {item.muscleGroup}
            </Text>
            <View style={styles.barTrack}>
              <View style={styles.barFill}>
                <View
                  style={[styles.bar, { flex: item.volume }]}
                />
                <View style={{ flex: maxVolume - item.volume }} />
              </View>
            </View>
            <Text style={styles.volumeText}>{formatVolume(item.volume)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
  },
  chart: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  groupLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    width: 74,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    flex: 1,
    flexDirection: 'row',
  },
  bar: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  volumeText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    width: 36,
    textAlign: 'right',
  },
});
