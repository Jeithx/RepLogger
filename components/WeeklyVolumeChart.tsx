import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getWeeklyVolume } from '../db/historyQueries';
import { WeeklyVolume } from '../types';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

const BAR_MAX_HEIGHT = 100;
const NUM_WEEKS = 8;

function getWeekStart(dateStr: string): string {
  const ms = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z').getTime();
  const d = new Date(ms);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(ms + diff * 86400000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}

export default function WeeklyVolumeChart() {
  const [data, setData] = useState<WeeklyVolume[]>([]);
  const [tooltip, setTooltip] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setData(getWeeklyVolume(NUM_WEEKS));
    }, [])
  );

  const maxVolume = Math.max(...data.map((d) => d.totalVolume), 1);
  const thisWeek = getWeekStart(new Date().toISOString());
  const hasData = data.some((d) => d.totalVolume > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WEEKLY VOLUME</Text>
      {!hasData ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No workout data yet</Text>
        </View>
      ) : (
        <>
          {tooltip && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{tooltip}</Text>
            </View>
          )}
          <View style={styles.chart}>
            {data.map((week) => {
              const barHeight = Math.max((week.totalVolume / maxVolume) * BAR_MAX_HEIGHT, week.totalVolume > 0 ? 4 : 0);
              const isCurrent = week.weekStart === thisWeek;
              return (
                <Pressable
                  key={week.weekStart}
                  style={styles.barCol}
                  onPress={() =>
                    setTooltip(
                      week.totalVolume > 0
                        ? `${formatWeekLabel(week.weekStart)}: ${formatVolume(week.totalVolume)} kg`
                        : null
                    )
                  }
                >
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        { height: barHeight },
                        isCurrent ? styles.barCurrent : styles.barPast,
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, isCurrent && styles.barLabelCurrent]} numberOfLines={1}>
                    {formatWeekLabel(week.weekStart).split(' ')[1]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
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
    height: BAR_MAX_HEIGHT + 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
  },
  tooltip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tooltipText: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT + 20,
    gap: Spacing.xs,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barContainer: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    width: '80%',
    borderRadius: BorderRadius.sm,
    minWidth: 4,
  },
  barCurrent: {
    backgroundColor: Colors.primary,
  },
  barPast: {
    backgroundColor: Colors.surfaceElevated,
  },
  barLabel: {
    color: Colors.textTertiary,
    fontSize: 9,
    textAlign: 'center',
  },
  barLabelCurrent: {
    color: Colors.primary,
  },
});
