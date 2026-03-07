import { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Rect, Path, G } from 'react-native-svg';
import { Colors } from '../constants/theme';

export type RexMood = 'happy' | 'thinking' | 'excited' | 'neutral';

interface Props {
  mood?: RexMood;
  size?: number;
  animated?: boolean;
  onBounce?: boolean; // trigger bounce when true
}

// Animated SVG Rect for eye blink
const AnimatedRect = Animated.createAnimatedComponent(Rect);

function getMouthPath(mood: RexMood, scale: number): string {
  const s = scale / 80;
  if (mood === 'happy') {
    // Slight upward arc
    return `M ${22 * s},${52 * s} Q ${40 * s},${62 * s} ${58 * s},${52 * s}`;
  }
  if (mood === 'excited') {
    // Big upward arc
    return `M ${18 * s},${51 * s} Q ${40 * s},${67 * s} ${62 * s},${51 * s}`;
  }
  if (mood === 'thinking') {
    // Slight downward curve
    return `M ${24 * s},${54 * s} Q ${40 * s},${50 * s} ${56 * s},${54 * s}`;
  }
  // neutral — flat line
  return `M ${26 * s},${54 * s} L ${54 * s},${54 * s}`;
}

export default function RexMascot({ mood = 'neutral', size = 80, animated = true, onBounce = false }: Props) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const eyeHeightL = useSharedValue(1);
  const eyeHeightR = useSharedValue(1);
  const prevBounce = useRef(false);

  const s = size / 80; // scale factor for all SVG coords

  // Idle float animation
  useEffect(() => {
    if (!animated) return;
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 1000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [animated]);

  // Bounce on new insights
  useEffect(() => {
    if (onBounce && !prevBounce.current) {
      scale.value = withSpring(1.15, { damping: 6, stiffness: 200 }, () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      });
    }
    prevBounce.current = onBounce;
  }, [onBounce]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const eyeLStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeHeightL.value }],
  }));
  const eyeRStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeHeightR.value }],
  }));

  const handleTap = () => {
    // Blink both eyes
    eyeHeightL.value = withSequence(
      withTiming(0, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    eyeHeightR.value = withSequence(
      withTiming(0, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
  };

  const eyeW = 12 * s;
  const eyeH = 8 * s;
  const eyeRx = 3 * s;
  const eyeLx = 20 * s;
  const eyeRx2 = 48 * s;
  const eyeY = 27 * s;

  // For thinking mood, left eye is narrower
  const leftEyeH = mood === 'thinking' ? eyeH * 0.5 : eyeH;
  const leftEyeY = mood === 'thinking' ? eyeY + eyeH * 0.25 : eyeY;

  const mouthPath = getMouthPath(mood, size);
  const strokeColor = mood === 'excited' ? Colors.primary : Colors.primary;

  return (
    <Pressable onPress={handleTap}>
      <Animated.View style={containerStyle}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Head */}
          <Rect
            x={2 * s}
            y={2 * s}
            width={76 * s}
            height={76 * s}
            rx={16 * s}
            fill={Colors.surfaceElevated}
            stroke={Colors.primary}
            strokeWidth={2 * s}
          />

          {/* Left eye */}
          <G>
            <AnimatedRect
              x={eyeLx}
              y={leftEyeY}
              width={eyeW}
              height={leftEyeH}
              rx={eyeRx}
              fill={Colors.primary}
              style={eyeLStyle}
            />
          </G>

          {/* Right eye */}
          <G>
            <AnimatedRect
              x={eyeRx2}
              y={eyeY}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              fill={Colors.primary}
              style={eyeRStyle}
            />
          </G>

          {/* Mouth */}
          <Path
            d={mouthPath}
            stroke={strokeColor}
            strokeWidth={2.5 * s}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

// Insight IDs that signal a problem → thinking face
const PROBLEM_IDS = new Set([
  'PLATEAU_DETECTED',
  'VOLUME_DROP',
  'MUSCLE_IMBALANCE',
  'OVERTRAINING_RISK',
  'HYDRATION_POOR',
  'HYDRATION_TODAY_BEHIND',
  'MISSED_DAYS',
  'SHORT_REST',
  'WEIGHT_TREND_CUT_STALL',
  'NO_WEIGHT_LOGGED',
]);

// Insight IDs that signal success / milestone → excited face
const CELEBRATE_IDS = new Set([
  'FIRST_WORKOUT',
  'GOAL_REACHED',
  'CONSISTENCY_STREAK',
  'VOLUME_SPIKE',
  'WATER_STREAK',
  'WEIGHT_TREND_CUT',
  'WEIGHT_TREND_BULK',
  'CLOSE_TO_GOAL',
]);

export function moodFromInsight(id: string | undefined): RexMood {
  if (!id || id === 'DEFAULT') return 'happy'; // everything is fine
  // Prefix matches for dynamic IDs
  if (id.startsWith('NEW_PR_') || id.startsWith('MILESTONE_')) return 'excited';
  if (CELEBRATE_IDS.has(id)) return 'excited';
  if (PROBLEM_IDS.has(id)) return 'thinking';
  // Informational / neutral rules
  return 'neutral';
}
