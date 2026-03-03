import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PRResult } from '../types';
import { WeightUnit } from '../utils/weightUtils';
import { kgToDisplay } from '../utils/weightUtils';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

interface PROverlayProps {
  prs: PRResult[];
  unit: WeightUnit;
  visible: boolean;
  onDone: () => void;
}

export default function PROverlay({ prs, unit, visible, onDone }: PROverlayProps) {
  const [index, setIndex] = useState(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = () => {
    setIndex((prev) => {
      const next = prev + 1;
      if (next >= prs.length) {
        opacity.value = withTiming(0, { duration: 400 }, (done) => {
          if (done) runOnJS(onDone)();
        });
        return prev;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    scale.value = 0;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 200);
    } catch {}

    timerRef.current = setTimeout(() => {
      if (prs.length <= 1) {
        opacity.value = withTiming(0, { duration: 400 }, (done) => {
          if (done) runOnJS(onDone)();
        });
      } else {
        advance();
        timerRef.current = setTimeout(() => {
          opacity.value = withTiming(0, { duration: 400 }, (done) => {
            if (done) runOnJS(onDone)();
          });
        }, 1500);
      }
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!visible || prs.length === 0) return null;

  const pr = prs[index] ?? prs[0];

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        opacity.value = withTiming(0, { duration: 300 }, (done) => {
          if (done) runOnJS(onDone)();
        });
      }} />
      <Animated.View style={[styles.card, contentStyle]}>
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.newPR}>NEW PR!</Text>
        <Text style={styles.exerciseName}>{pr.exerciseName}</Text>
        <Text style={styles.weight}>
          {kgToDisplay(pr.weightKg, unit)}{unit} × {pr.reps} reps
        </Text>
        <Text style={styles.estimated}>
          ~{kgToDisplay(pr.estimated1rm, unit)} {unit} estimated 1RM
        </Text>
        {prs.length > 1 && (
          <Text style={styles.counter}>{index + 1} of {prs.length}</Text>
        )}
        <Text style={styles.dismiss}>Tap to dismiss</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.primary,
    width: '85%',
  },
  trophy: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  newPR: {
    color: Colors.primary,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    letterSpacing: 2,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  weight: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    marginTop: Spacing.xs,
  },
  estimated: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
  },
  counter: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
  },
  dismiss: {
    color: Colors.textTertiary,
    fontSize: Typography.size.xs,
    marginTop: Spacing.sm,
  },
});
