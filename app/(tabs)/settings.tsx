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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import { getSetting, setSetting } from '../../db/settingsQueries';
import {
  getWorkoutSetsForExport,
  getBodyWeightForExport,
  clearAllUserData,
} from '../../db/exportQueries';
import { useRoutineStore } from '../../store/useRoutineStore';
import { useWaterStore } from '../../store/useWaterStore';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

const WATER_COLOR = '#4FC3F7';

type WeightUnit = 'kg' | 'lbs';
type RestOption = '60' | '90' | '120' | '180';
type WaterUnit = 'ml' | 'oz';

const REST_OPTIONS: RestOption[] = ['60', '90', '120', '180'];
const REST_LABELS: Record<RestOption, string> = { '60': '60s', '90': '90s', '120': '2m', '180': '3m' };

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function PillGroup<T extends string>({
  options,
  value,
  labels,
  onChange,
}: {
  options: T[];
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.pillGroup}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={({ pressed }) => [
            styles.pill,
            value === opt && styles.pillActive,
            pressed && styles.pillPressed,
          ]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.pillText, value === opt && styles.pillTextActive]}>
            {labels[opt]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function DataRow({
  label,
  icon,
  onPress,
  destructive,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.dataRow, pressed && styles.dataRowPressed]}
      onPress={onPress}
    >
      <Text style={styles.dataRowIcon}>{icon}</Text>
      <Text style={[styles.dataRowLabel, destructive && styles.dataRowDestructive]}>
        {label}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [restTimer, setRestTimer] = useState<RestOption>('90');
  const [exporting, setExporting] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const { dailyGoalMl, waterUnit, setDailyGoal, setWaterUnit, loadSettings: loadWaterSettings } = useWaterStore();

  useFocusEffect(
    useCallback(() => {
      const u = getSetting('weight_unit');
      setUnit(u === 'lbs' ? 'lbs' : 'kg');
      const r = getSetting('rest_timer_seconds');
      setRestTimer(REST_OPTIONS.includes(r as RestOption) ? (r as RestOption) : '90');
      loadWaterSettings();
      setWaterGoalInput(String(dailyGoalMl));
    }, [loadWaterSettings, dailyGoalMl])
  );

  const handleWaterGoalBlur = () => {
    const parsed = parseInt(waterGoalInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDailyGoal(parsed);
    } else {
      setWaterGoalInput(String(dailyGoalMl));
    }
  };

  const handleUnitChange = (v: WeightUnit) => {
    setUnit(v);
    setSetting('weight_unit', v);
  };

  const handleRestChange = (v: RestOption) => {
    setRestTimer(v);
    setSetting('rest_timer_seconds', v);
  };

  const exportCSV = async (type: 'workouts' | 'bodyweight') => {
    if (exporting) return;
    setExporting(true);
    try {
      let csv = '';
      let filename = '';
      if (type === 'workouts') {
        const rows = getWorkoutSetsForExport();
        csv =
          'Date,Exercise,Muscle Group,Set,Weight (kg),Reps\n' +
          rows
            .map(
              (r) =>
                `${r.date},"${r.exercise}","${r.muscleGroup}",${r.set},${r.weightKg},${r.reps}`
            )
            .join('\n');
        filename = 'hrmetrics_workouts.csv';
      } else {
        const rows = getBodyWeightForExport();
        csv =
          'Date,Weight (kg),Notes\n' +
          rows.map((r) => `${r.date},${r.weightKg},"${r.notes ?? ''}"`).join('\n');
        filename = 'hrmetrics_bodyweight.csv';
      }
      const uri = (FileSystem.cacheDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(uri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Sharing not available', 'Cannot share files on this device.');
      }
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data?',
      'All workouts, body weight entries, and personal records will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: () => {
                    try {
                      clearAllUserData();
                      useRoutineStore.getState().loadRoutines();
                      router.replace('/onboarding');
                    } catch {
                      Alert.alert('Error', 'Failed to clear data.');
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* ── Preferences ─────────────────────────── */}
      <SectionHeader title="PREFERENCES" />
      <View style={styles.card}>
        <View style={styles.settingsRow}>
          <Text style={styles.rowLabel}>Weight Unit</Text>
          <PillGroup<WeightUnit>
            options={['kg', 'lbs']}
            value={unit}
            labels={{ kg: 'KG', lbs: 'LBS' }}
            onChange={handleUnitChange}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.settingsRow}>
          <Text style={styles.rowLabel}>Rest Timer</Text>
          <PillGroup<RestOption>
            options={REST_OPTIONS}
            value={restTimer}
            labels={REST_LABELS}
            onChange={handleRestChange}
          />
        </View>
        <View style={styles.divider} />
        <DataRow
          label="Manage Exercises"
          icon="🏋️"
          onPress={() => router.push('/exercises')}
        />
        <View style={styles.divider} />
        <DataRow
          label="Notifications"
          icon="🔔"
          onPress={() => router.push('/settings/notifications')}
        />
      </View>

      {/* ── Data ────────────────────────────────── */}
      <SectionHeader title="DATA" />
      <View style={styles.card}>
        <DataRow
          label="Backup & Restore"
          icon="🔒"
          onPress={() => router.push('/settings/backup')}
        />
        <View style={styles.divider} />
        <DataRow
          label={exporting ? 'Exporting…' : 'Export Workouts (CSV)'}
          icon="📊"
          onPress={() => exportCSV('workouts')}
        />
        <View style={styles.divider} />
        <DataRow
          label={exporting ? 'Exporting…' : 'Export Body Weight (CSV)'}
          icon="⚖️"
          onPress={() => exportCSV('bodyweight')}
        />
        <View style={styles.divider} />
        <DataRow
          label="Clear All Data"
          icon="🗑️"
          onPress={handleClearData}
          destructive
        />
      </View>

      {/* ── Water ───────────────────────────────── */}
      <SectionHeader title="WATER" />
      <View style={styles.card}>
        <View style={styles.settingsRow}>
          <Text style={styles.rowLabel}>Daily Goal</Text>
          <View style={styles.waterGoalRow}>
            <TextInput
              style={styles.waterGoalInput}
              value={waterGoalInput}
              onChangeText={setWaterGoalInput}
              onBlur={handleWaterGoalBlur}
              keyboardType="number-pad"
              selectTextOnFocus
            />
            <Text style={styles.waterGoalUnit}>ml</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.settingsRow}>
          <Text style={styles.rowLabel}>Unit</Text>
          <PillGroup<WaterUnit>
            options={['ml', 'oz']}
            value={waterUnit}
            labels={{ ml: 'ML', oz: 'OZ' }}
            onChange={(v) => setWaterUnit(v)}
          />
        </View>
      </View>

      {/* ── About ───────────────────────────────── */}
      <SectionHeader title="ABOUT" />
      <View style={styles.card}>
        <View style={styles.settingsRow}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.taglineRow}>
          <Text style={styles.tagline}>
            Built for lifters who care about the details.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 52,
    gap: Spacing.md,
  },
  rowLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  rowValue: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillPressed: { opacity: 0.8 },
  pillText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  pillTextActive: { color: Colors.background },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 52,
    gap: Spacing.md,
  },
  dataRowPressed: { backgroundColor: Colors.surfaceElevated },
  dataRowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  dataRowLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  dataRowDestructive: { color: Colors.error },
  chevron: { color: Colors.textTertiary, fontSize: 20, lineHeight: 22 },
  taglineRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  waterGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  waterGoalInput: {
    backgroundColor: Colors.surfaceElevated,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 64,
    textAlign: 'center',
  },
  waterGoalUnit: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
});
