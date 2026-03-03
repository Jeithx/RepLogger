import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createRoutine, addRoutineDay, applyTemplate, updateRoutineDayName } from '../../db/routineQueries';
import { useRoutineStore } from '../../store/useRoutineStore';
import { ROUTINE_TEMPLATES, RoutineTemplate } from '../../constants/routineTemplates';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

const DAY_SUGGESTIONS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Rest'];
const DAY_COUNT_OPTIONS = [2, 3, 4, 5, 6];

interface DayEntry {
  id: number;
  name: string;
}

// ─── Step indicator ────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.stepDot, i + 1 === current && styles.stepDotActive]}
        />
      ))}
    </View>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: RoutineTemplate | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const isBlank = template === null;
  return (
    <Pressable
      style={[styles.templateCard, selected && styles.templateCardSelected]}
      onPress={onSelect}
    >
      <Text style={[styles.templateName, selected && styles.templateNameSelected]}>
        {isBlank ? 'Blank' : template.name}
      </Text>
      <Text style={styles.templateDesc}>
        {isBlank ? 'Start from scratch' : template.description}
      </Text>
    </Pressable>
  );
}

export default function BuilderScreen() {
  const { loadRoutines } = useRoutineStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [routineName, setRoutineName] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [createdRoutineId, setCreatedRoutineId] = useState<number | null>(null);
  const [days, setDays] = useState<DayEntry[]>([]);

  const selectedTemplate = ROUTINE_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null;

  const handleSelectTemplate = (template: RoutineTemplate | null) => {
    setSelectedTemplateId(template?.id ?? null);
    if (template) {
      setRoutineName((prev) => (prev === '' ? template.name : prev));
      setDaysPerWeek(template.daysPerWeek);
    }
  };

  const handleNext = () => {
    const trimmed = routineName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a routine name.');
      return;
    }

    try {
      const routineId = createRoutine(trimmed, daysPerWeek);
      setCreatedRoutineId(routineId);

      const dayIds: number[] = [];
      const count = selectedTemplate ? selectedTemplate.days.length : daysPerWeek;

      for (let i = 0; i < count; i++) {
        const templateDayName = selectedTemplate?.days[i]?.name ?? `Day ${i + 1}`;
        const dayId = addRoutineDay(routineId, i + 1, templateDayName);
        dayIds.push(dayId);
      }

      if (selectedTemplate) {
        applyTemplate(dayIds, selectedTemplate);
      }

      const newDays: DayEntry[] = dayIds.map((id, i) => ({
        id,
        name: selectedTemplate?.days[i]?.name ?? `Day ${i + 1}`,
      }));

      setDays(newDays);
      setStep(2);
    } catch (error) {
      console.error('Builder handleNext failed:', error);
      Alert.alert('Error', 'Failed to create routine. Please try again.');
    }
  };

  const handleDayNameChange = (dayId: number, name: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name } : d)));
  };

  const handleDayNameCommit = (dayId: number, name: string) => {
    updateRoutineDayName(dayId, name);
  };

  const handleSuggestion = (dayId: number, suggestion: string) => {
    handleDayNameChange(dayId, suggestion);
    handleDayNameCommit(dayId, suggestion);
  };

  const handleDone = () => {
    if (!createdRoutineId) return;
    loadRoutines();
    router.replace(`/routines/${createdRoutineId}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => (step === 1 ? router.back() : setStep(1))} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'New Routine' : 'Set Up Days'}
        </Text>
        <StepIndicator current={step} total={2} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            {/* Template selection */}
            <Text style={styles.sectionLabel}>Start from a template</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.templateScroll}
              contentContainerStyle={styles.templateScrollContent}
            >
              <TemplateCard
                template={null}
                selected={selectedTemplateId === null}
                onSelect={() => handleSelectTemplate(null)}
              />
              {ROUTINE_TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  selected={selectedTemplateId === t.id}
                  onSelect={() => handleSelectTemplate(t)}
                />
              ))}
            </ScrollView>

            {/* Routine name */}
            <Text style={styles.sectionLabel}>Routine name</Text>
            <TextInput
              style={styles.nameInput}
              value={routineName}
              onChangeText={setRoutineName}
              placeholder="e.g. My PPL Routine"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="next"
            />

            {/* Days per week */}
            <Text style={styles.sectionLabel}>Days per week</Text>
            <View style={styles.pillRow}>
              {DAY_COUNT_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  style={[styles.pill, daysPerWeek === n && styles.pillSelected]}
                  onPress={() => setDaysPerWeek(n)}
                >
                  <Text style={[styles.pillText, daysPerWeek === n && styles.pillTextSelected]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Name each training day</Text>
            <Text style={styles.sectionHint}>Tap a day to add exercises</Text>

            {days.map((day, idx) => (
              <View key={day.id} style={styles.dayBlock}>
                <View style={styles.dayRow}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{idx + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.dayNameInput}
                    value={day.name}
                    onChangeText={(v) => handleDayNameChange(day.id, v)}
                    onBlur={() => handleDayNameCommit(day.id, day.name)}
                    placeholder="Day name"
                    placeholderTextColor={Colors.textTertiary}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={styles.editDayBtn}
                    onPress={() =>
                      router.push(
                        `/routines/day-editor?routineDayId=${day.id}&dayName=${encodeURIComponent(day.name)}`
                      )
                    }
                  >
                    <Text style={styles.editDayText}>Edit →</Text>
                  </Pressable>
                </View>

                {/* Quick suggestion chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionScroll}
                  contentContainerStyle={styles.suggestionContent}
                >
                  {DAY_SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.suggestionChip}
                      onPress={() => handleSuggestion(day.id, s)}
                    >
                      <Text style={styles.suggestionText}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={styles.footer}>
        {step === 1 ? (
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
            onPress={handleNext}
          >
            <Text style={styles.ctaBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
            onPress={handleDone}
          >
            <Ionicons name="checkmark" size={18} color={Colors.background} />
            <Text style={styles.ctaBtnText}>Done</Text>
          </Pressable>
        )}
      </View>
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
  stepRow: { flexDirection: 'row', gap: Spacing.xs },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.primary },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHint: {
    color: Colors.textTertiary,
    fontSize: Typography.size.sm,
    marginTop: -Spacing.sm,
  },
  templateScroll: { marginHorizontal: -Spacing.lg },
  templateScrollContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  templateCard: {
    width: 140,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  templateCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryMuted },
  templateName: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
  },
  templateNameSelected: { color: Colors.primary },
  templateDesc: { color: Colors.textSecondary, fontSize: Typography.size.xs },
  nameInput: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: Typography.size.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillRow: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { color: Colors.textSecondary, fontSize: Typography.size.md, fontWeight: Typography.weight.semibold },
  pillTextSelected: { color: Colors.background },
  dayBlock: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  dayBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: { color: Colors.textSecondary, fontSize: Typography.size.sm, fontWeight: Typography.weight.bold },
  dayNameInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    paddingVertical: Spacing.xs,
  },
  editDayBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  editDayText: { color: Colors.primary, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  suggestionScroll: { borderTopWidth: 1, borderTopColor: Colors.border },
  suggestionContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  suggestionChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: { color: Colors.textSecondary, fontSize: Typography.size.xs },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  ctaBtnPressed: { opacity: 0.85 },
  ctaBtnText: { color: Colors.background, fontSize: Typography.size.md, fontWeight: Typography.weight.bold },
});
