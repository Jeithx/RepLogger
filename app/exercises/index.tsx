import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, MuscleGroup } from '../../types';
import { useExerciseStore } from '../../store/useExerciseStore';
import ExerciseFormModal from '../../components/ExerciseFormModal';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';

const MUSCLE_ORDER: MuscleGroup[] = [
  MuscleGroup.Chest,
  MuscleGroup.Back,
  MuscleGroup.Legs,
  MuscleGroup.Shoulders,
  MuscleGroup.Arms,
  MuscleGroup.Core,
  MuscleGroup.Cardio,
  MuscleGroup.Other,
];

const DELETE_WIDTH = 72;

// ─── Swipeable Custom Exercise Row ─────────────────────────────────────────

interface CustomRowProps {
  exercise: Exercise;
  onEdit: () => void;
  onDelete: () => void;
}

function SwipeableCustomRow({ exercise, onEdit, onDelete }: CustomRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
      onPanResponderMove: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const clamped = Math.max(-DELETE_WIDTH, Math.min(0, dx + base));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, { dx }) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        if (dx + base < -DELETE_WIDTH / 2) {
          Animated.spring(translateX, { toValue: -DELETE_WIDTH, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  const close = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    isOpen.current = false;
  };

  const handleDeletePress = () => {
    close();
    onDelete();
  };

  return (
    <View style={styles.swipeWrapper}>
      <View style={styles.deleteZone}>
        <Pressable style={styles.deleteAction} onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={20} color={Colors.text} />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: Colors.background }}
        {...pan.panHandlers}
      >
        <View style={styles.exerciseRow}>
          <View style={styles.rowLeft}>
            <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Custom</Text>
            </View>
          </View>
          <Pressable onPress={onEdit} hitSlop={8} style={styles.editIcon}>
            <Ionicons name="pencil-outline" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Default Exercise Row ───────────────────────────────────────────────────

function DefaultRow({ exercise }: { exercise: Exercise }) {
  return (
    <View style={styles.exerciseRow}>
      <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const { exercises, loadExercises, deleteExercise } = useExerciseStore();
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadExercises();
    }, [loadExercises])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises;
  }, [query, exercises]);

  type ListItem =
    | { type: 'header'; group: MuscleGroup }
    | { type: 'exercise'; exercise: Exercise };

  const flatItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    for (const group of MUSCLE_ORDER) {
      const groupExercises = filtered.filter((e) => e.muscle_group === group);
      if (groupExercises.length === 0) continue;
      items.push({ type: 'header', group });
      for (const exercise of groupExercises) {
        items.push({ type: 'exercise', exercise });
      }
    }
    // Exercises with muscle groups not in MUSCLE_ORDER (shouldn't happen, but safety)
    const knownGroups = new Set<string>(MUSCLE_ORDER);
    const extra = filtered.filter((e) => !knownGroups.has(e.muscle_group));
    if (extra.length > 0) {
      items.push({ type: 'header', group: MuscleGroup.Other });
      for (const exercise of extra) {
        items.push({ type: 'exercise', exercise });
      }
    }
    return items;
  }, [filtered]);

  const handleDelete = (exercise: Exercise) => {
    const result = deleteExercise(exercise.id);
    if (!result.canDelete) {
      Alert.alert(
        'Cannot Delete',
        `"${exercise.name}" is used in ${result.usageCount} routine(s) or past workout(s) and cannot be deleted.`,
        [{ text: 'OK' }]
      );
    }
  };

  const confirmDelete = (exercise: Exercise) => {
    Alert.alert(
      'Delete Exercise',
      `Delete "${exercise.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(exercise),
        },
      ]
    );
  };

  const openCreate = () => {
    setEditingExercise(null);
    setModalVisible(true);
  };

  const openEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setModalVisible(true);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.groupHeader}>{item.group.toUpperCase()}</Text>;
    }
    const { exercise } = item;
    if (exercise.is_custom === 1) {
      return (
        <SwipeableCustomRow
          exercise={exercise}
          onEdit={() => openEdit(exercise)}
          onDelete={() => confirmDelete(exercise)}
        />
      );
    }
    return <DefaultRow exercise={exercise} />;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Exercises</Text>
        <Pressable onPress={openCreate} hitSlop={12} style={styles.addBtn}>
          <Ionicons name="add" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises…"
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

      {/* List */}
      <FlatList
        data={flatItems}
        keyExtractor={(item, index) =>
          item.type === 'header' ? `h-${item.group}` : `e-${item.exercise.id}-${index}`
        }
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exercises found</Text>
          </View>
        }
      />

      <ExerciseFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingExercise={editingExercise}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    marginLeft: Spacing.xs,
  },
  addBtn: { padding: Spacing.xs },

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
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.size.md,
    paddingVertical: Spacing.md,
  },

  listContent: { paddingBottom: Spacing.xxxl },

  groupHeader: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.background,
  },

  // Swipe wrapper
  swipeWrapper: { overflow: 'hidden' },
  deleteZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: { alignItems: 'center', gap: 2 },
  deleteActionText: {
    color: Colors.text,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },

  // Row
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
    flexShrink: 1,
  },
  customBadge: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  customBadgeText: {
    color: Colors.primary,
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
  },
  editIcon: { padding: Spacing.xs },

  empty: { alignItems: 'center', paddingTop: Spacing.xxxl },
  emptyText: { color: Colors.textTertiary, fontSize: Typography.size.md },
});
