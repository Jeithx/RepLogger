import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Exercise, MuscleGroup } from '../types';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';
import { useExerciseStore } from '../store/useExerciseStore';
import { exerciseNameExists } from '../db/exerciseQueries';

const MUSCLE_GROUPS: MuscleGroup[] = [
  MuscleGroup.Chest,
  MuscleGroup.Back,
  MuscleGroup.Legs,
  MuscleGroup.Shoulders,
  MuscleGroup.Arms,
  MuscleGroup.Core,
  MuscleGroup.Cardio,
  MuscleGroup.Other,
];

interface Props {
  visible: boolean;
  onClose: () => void;
  editingExercise?: Exercise | null;
}

export default function ExerciseFormModal({ visible, onClose, editingExercise }: Props) {
  const createExercise = useExerciseStore((s) => s.createExercise);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (editingExercise) {
        setName(editingExercise.name);
        setMuscleGroup(editingExercise.muscle_group);
      } else {
        setName('');
        setMuscleGroup(null);
      }
      setError('');
    }
  }, [visible, editingExercise]);

  const isValid = name.trim().length > 0 && muscleGroup !== null;

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || !muscleGroup) return;
    if (trimmed.length > 50) {
      setError('Name must be 50 characters or less.');
      return;
    }
    if (exerciseNameExists(trimmed, editingExercise?.id)) {
      setError('An exercise with this name already exists.');
      return;
    }
    if (editingExercise) {
      updateExercise(editingExercise.id, trimmed, muscleGroup);
    } else {
      createExercise(trimmed, muscleGroup);
    }
    onClose();
  }, [name, muscleGroup, editingExercise, createExercise, updateExercise, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrapper}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {editingExercise ? 'Edit Exercise' : 'New Exercise'}
          </Text>

          <Text style={styles.label}>Exercise Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => { setName(t); setError(''); }}
            placeholder="e.g. Incline DB Curl"
            placeholderTextColor={Colors.textTertiary}
            maxLength={50}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={styles.label}>Muscle Group</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}
          >
            {MUSCLE_GROUPS.map((mg) => (
              <Pressable
                key={mg}
                style={[styles.chip, muscleGroup === mg && styles.chipActive]}
                onPress={() => setMuscleGroup(mg)}
              >
                <Text style={[styles.chipText, muscleGroup === mg && styles.chipTextActive]}>
                  {mg}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {error.length > 0 && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kvWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    marginBottom: Spacing.sm,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    color: Colors.text,
    fontSize: Typography.size.md,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  chipTextActive: {
    color: Colors.background,
  },
  error: {
    color: Colors.error,
    fontSize: Typography.size.sm,
    marginTop: Spacing.xs,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
});
