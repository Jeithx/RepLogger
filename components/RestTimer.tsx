import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, AppStateStatus, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';
import { showRestTimerNotification, dismissRestTimerNotification } from '../utils/notificationService';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 120;
const RING_STROKE = 6;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SCREEN_HEIGHT = Dimensions.get('window').height;

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
  const restEndTimeRef = useRef<number>(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;
  const slideY = useSharedValue(SCREEN_HEIGHT * 0.5);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const startCountdown = (endTime: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
    }, 500);
  };

  useEffect(() => {
    if (visible) {
      const endTime = Date.now() + durationSeconds * 1000;
      restEndTimeRef.current = endTime;
      setRemaining(durationSeconds);

      // Animate ring from full to empty
      dashOffset.setValue(0);
      Animated.timing(dashOffset, {
        toValue: CIRCUMFERENCE,
        duration: durationSeconds * 1000,
        useNativeDriver: false,
      }).start();

      slideY.value = withSpring(0, { damping: 22, stiffness: 180 });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      startCountdown(endTime);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      dashOffset.stopAnimation();
      slideY.value = SCREEN_HEIGHT * 0.5;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      dismissRestTimerNotification().catch(() => { });
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, durationSeconds]);

  // Handle app going to background / foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (!visible) return;

      if (prev === 'active' && nextState !== 'active') {
        // App going to background — show notification
        if (intervalRef.current) clearInterval(intervalRef.current);
        dashOffset.stopAnimation();
        showRestTimerNotification(restEndTimeRef.current).catch(() => { });
      } else if (prev !== 'active' && nextState === 'active') {
        // App returning to foreground — resume
        dismissRestTimerNotification().catch(() => { });
        const rem = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        setRemaining(rem);

        if (rem > 0) {
          // Restart ring animation from current remaining
          const progressDone = 1 - rem / durationSeconds;
          dashOffset.setValue(progressDone * CIRCUMFERENCE);
          Animated.timing(dashOffset, {
            toValue: CIRCUMFERENCE,
            duration: rem * 1000,
            useNativeDriver: false,
          }).start();
          startCountdown(restEndTimeRef.current);
        }
      }
    });

    return () => subscription.remove();
  }, [visible, durationSeconds]);

  if (!visible) return null;

  const ringColor =
    remaining === 0 ? Colors.success : remaining <= 10 ? Colors.error : Colors.primary;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Reanimated.View style={[styles.card, cardStyle]}>
        <Text style={styles.label}>Rest</Text>

        <View style={styles.ringWrapper}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Background track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={Colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Animated progress arc */}
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.countdownOverlay}>
            <Text style={[
              styles.countdown,
              remaining === 0 && styles.countdownDone,
              remaining <= 10 && remaining > 0 && styles.countdownWarning,
            ]}>
              {formatTime(remaining)}
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipButtonPressed]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            onDismiss();
          }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </Reanimated.View>
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
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: Spacing.xl,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  countdownWarning: {
    color: Colors.error,
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
