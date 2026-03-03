import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

const RING_SIZE = 120;
const RING_STROKE = 6;

interface Props {
  visible: boolean;
  durationSeconds?: number;
  onDismiss: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}`;
}

export default function RestTimer({ visible, durationSeconds = 90, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setRemaining(durationSeconds);
      progressAnim.setValue(1);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      Animated.timing(progressAnim, {
        toValue: 0,
        duration: durationSeconds * 1000,
        useNativeDriver: false,
      }).start();

      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, durationSeconds]);

  if (!visible) return null;

  const circumference = Math.PI * (RING_SIZE - RING_STROKE);
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View style={styles.card}>
        <Text style={styles.label}>Rest</Text>

        <View style={styles.ringContainer}>
          <View style={styles.ringOuter}>
            <Animated.View
              style={[
                styles.ringProgress,
                {
                  borderColor: remaining === 0 ? Colors.success : Colors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.countdownContainer}>
            <Text style={[styles.countdown, remaining === 0 && styles.countdownDone]}>
              {formatTime(remaining)}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onDismiss();
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: 240,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  ringOuter: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderColor: Colors.border,
  },
  ringProgress: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    color: Colors.text,
    fontSize: Typography.size.xxxl,
    fontWeight: Typography.weight.bold,
  },
  countdownDone: {
    color: Colors.success,
  },
  skipButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipButtonPressed: {
    backgroundColor: Colors.surface,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
  },
});
