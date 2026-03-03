import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WorkoutPhase } from '../types';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';
import { WeightUnit } from '../utils/weightUtils';

const PHASE_COLOR: Record<string, string> = {
  cut: Colors.error,
  bulk: Colors.success,
  maintain: '#4488FF',
};

const PHASES: {
  key: WorkoutPhase;
  label: string;
  icon: string;
  description: string;
}[] = [
  { key: 'cut', label: 'CUT', icon: '↓', description: 'Losing weight, caloric deficit' },
  { key: 'bulk', label: 'BULK', icon: '↑', description: 'Gaining muscle, caloric surplus' },
  { key: 'maintain', label: 'MAINTAIN', icon: '→', description: 'Holding current weight' },
];

interface PhaseSelectorProps {
  visible: boolean;
  currentPhase: WorkoutPhase | '' | null;
  currentGoalWeight: number | null;
  weightUnit: WeightUnit;
  onConfirm: (phase: WorkoutPhase | '', goalWeight?: number) => void;
  onClose: () => void;
}

export default function PhaseSelector({
  visible,
  currentPhase,
  currentGoalWeight,
  weightUnit,
  onConfirm,
  onClose,
}: PhaseSelectorProps) {
  const [selected, setSelected] = useState<WorkoutPhase | ''>(currentPhase ?? '');
  const [goalInput, setGoalInput] = useState(
    currentGoalWeight != null ? String(currentGoalWeight) : ''
  );

  const handleConfirm = () => {
    const goalKg = goalInput ? parseFloat(goalInput.replace(',', '.')) : undefined;
    onConfirm(selected, isNaN(goalKg ?? NaN) ? undefined : goalKg);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Set Training Phase</Text>

        <View style={styles.phaseCards}>
          {PHASES.map((p) => {
            const isActive = selected === p.key;
            const color = PHASE_COLOR[p.key];
            return (
              <Pressable
                key={p.key}
                style={[
                  styles.phaseCard,
                  isActive && { borderColor: color, backgroundColor: color + '18' },
                ]}
                onPress={() => setSelected(isActive ? '' : p.key)}
              >
                <Text style={[styles.phaseIcon, isActive && { color }]}>{p.icon}</Text>
                <Text style={[styles.phaseLabel, isActive && { color }]}>{p.label}</Text>
                <Text style={styles.phaseDesc}>{p.description}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>Target weight ({weightUnit}) — optional</Text>
        <TextInput
          style={styles.goalInput}
          value={goalInput}
          onChangeText={setGoalInput}
          placeholder={`e.g. ${weightUnit === 'kg' ? '75' : '165'}`}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="decimal-pad"
        />

        <Pressable
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed]}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmText}>
            {selected ? `Set ${selected.toUpperCase()} Phase` : 'Clear Phase'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    textAlign: 'center',
  },
  phaseCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  phaseCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  phaseIcon: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
  },
  phaseLabel: {
    color: Colors.text,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    letterSpacing: 0.5,
  },
  phaseDesc: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    textAlign: 'center',
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
  goalInput: {
    backgroundColor: Colors.surfaceElevated,
    color: Colors.text,
    fontSize: Typography.size.lg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  confirmBtnPressed: { opacity: 0.85 },
  confirmText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
