import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '../db/database';
import { Exercise, MuscleGroup } from '../types';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

interface Props {
  visible: boolean;
  onSelect: (exerciseId: number, exerciseName: string) => void;
  onClose: () => void;
}

const MUSCLE_ORDER: MuscleGroup[] = [
  MuscleGroup.Chest,
  MuscleGroup.Back,
  MuscleGroup.Legs,
  MuscleGroup.Shoulders,
  MuscleGroup.Arms,
  MuscleGroup.Core,
];

function loadExercises(): Exercise[] {
  try {
    const db = getDatabase();
    return db.getAllSync<Exercise>('SELECT * FROM exercises ORDER BY muscle_group, name;');
  } catch (error) {
    console.error('Failed to load exercises:', error);
    return [];
  }
}

export default function ExercisePicker({ visible, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setExercises(loadExercises());
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? exercises.filter((e) => e.name.toLowerCase().includes(q))
      : exercises;

    const grouped = MUSCLE_ORDER.map((group) => ({
      group,
      data: filtered.filter((e) => e.muscle_group === group),
    })).filter((s) => s.data.length > 0);

    return grouped;
  }, [query, exercises]);

  type ListItem =
    | { type: 'header'; group: MuscleGroup }
    | { type: 'exercise'; exercise: Exercise };

  const flatItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    for (const section of sections) {
      items.push({ type: 'header', group: section.group });
      for (const exercise of section.data) {
        items.push({ type: 'exercise', exercise });
      }
    }
    return items;
  }, [sections]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupHeader}>{item.group}</Text>;
    }
    const { exercise } = item;
    return (
      <Pressable
        style={({ pressed }) => [styles.exerciseRow, pressed && styles.exerciseRowPressed]}
        onPress={() => {
          onSelect(exercise.id, exercise.name);
          onClose();
        }}
      >
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{exercise.muscle_group}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercise</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={Colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <FlatList
          data={flatItems}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `h-${item.group}` : `e-${item.exercise.id}-${index}`
          }
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No exercises found</Text>
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    paddingVertical: Spacing.md,
  },
  list: {
    paddingBottom: Spacing.xxxl,
  },
  groupHeader: {
    color: Colors.textSecondary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  exerciseRowPressed: {
    backgroundColor: Colors.surface,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  badge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.size.md,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
});
