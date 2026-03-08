import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInsightStore } from '../store/useInsightStore';
import { getWeekStats } from '../db/historyQueries';
import { getBodyWeightStats } from '../db/bodyWeightQueries';
import { getSetting } from '../db/settingsQueries';
import { kgToDisplay, formatVolume, WeightUnit } from '../utils/weightUtils';
import { getWaterHistory } from '../db/waterQueries';
import RexMascot, { moodFromInsight } from '../components/RexMascot';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';
import type { Insight } from '../utils/insightEngine';

const CATEGORY_COLOR: Record<string, string> = {
  workout: Colors.primary,
  weight: '#FF9500',
  water: '#4FC3F7',
  recovery: '#FF6B6B',
  milestone: '#A78BFA',
};

function InsightCard({ insight }: { insight: Insight }) {
  const accent = CATEGORY_COLOR[insight.category] ?? Colors.primary;
  return (
    <View style={[styles.insightCard, { borderLeftColor: accent }]}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightIcon}>{insight.icon}</Text>
        <Text style={styles.insightTitle}>{insight.title}</Text>
      </View>
      <Text style={styles.insightMessage}>{insight.message}</Text>
      {insight.actionLabel && insight.actionRoute && (
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(insight.actionRoute as never)}
        >
          <Text style={[styles.actionBtnText, { color: accent }]}>{insight.actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function RexScreen() {
  const insets = useSafeAreaInsets();
  const { insights, isLoading, lastGeneratedAt } = useInsightStore();

  const topInsight = insights[0];
  const mood = moodFromInsight(topInsight?.id);

  // Weekly summary
  let weekCount = 0;
  let weekVolume = 0;
  let waterGoalDays = 0;
  let bwChange: number | null = null;
  let unit: WeightUnit = 'kg';

  try {
    const weekStats = getWeekStats();
    weekCount = weekStats.count;
    weekVolume = weekStats.volume;

    const unitStr = getSetting('weight_unit');
    unit = unitStr === 'lbs' ? 'lbs' : 'kg';

    const dailyGoalMl = parseInt(getSetting('daily_water_goal_ml') || '2500', 10);
    const waterHistory = getWaterHistory(7, 0);
    waterGoalDays = waterHistory.filter((d) => d.totalMl >= dailyGoalMl).length;

    const bwStats = getBodyWeightStats();
    if (bwStats.current !== null && bwStats.sevenDayAvg !== null) {
      bwChange = kgToDisplay(bwStats.current, unit) - kgToDisplay(bwStats.sevenDayAvg, unit);
    }
  } catch {
    // ignore
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxxl }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>REX</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* REX face */}
      <View style={styles.mascotSection}>
        <RexMascot mood={mood} size={120} animated />
        <Text style={styles.rexName}>REX</Text>
        <Text style={styles.rexSubtitle}>Rep EXpert</Text>
        {lastGeneratedAt && (
          <Text style={styles.lastUpdated}>
            Last analyzed: {new Date(lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Insights */}
      <Text style={styles.sectionLabel}>Today's Insights</Text>
      {isLoading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      ) : insights.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>All good. Nothing to report today. Just show up.</Text>
        </View>
      ) : (
        insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
          />
        ))
      )}

      {/* Weekly Summary */}
      <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Weekly Summary</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Workouts this week</Text>
          <Text style={styles.summaryValue}>{weekCount}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total volume</Text>
          <Text style={styles.summaryValue}>{formatVolume(weekVolume, unit)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Water goal hit</Text>
          <Text style={styles.summaryValue}>{waterGoalDays}/7 days</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Body weight (7d change)</Text>
          <Text
            style={[
              styles.summaryValue,
              bwChange !== null && bwChange > 0 && { color: Colors.success },
              bwChange !== null && bwChange < 0 && { color: Colors.error },
            ]}
          >
            {bwChange !== null
              ? `${bwChange > 0 ? '+' : ''}${bwChange.toFixed(1)} ${unit}`
              : '—'}
          </Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    letterSpacing: 2,
  },
  mascotSection: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  rexName: {
    color: Colors.primary,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    letterSpacing: 3,
    marginTop: Spacing.sm,
  },
  rexSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  lastUpdated: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    gap: Spacing.xs,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightIcon: { fontSize: 20 },
  insightTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  insightMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    lineHeight: Typography.size.sm * Typography.lineHeight.normal,
  },
  actionBtn: { marginTop: Spacing.xs },
  actionBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: { color: Colors.textSecondary, fontSize: Typography.size.sm },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
});
