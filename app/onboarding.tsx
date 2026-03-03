import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { setSetting } from '../db/settingsQueries';
import { BorderRadius, Colors, Spacing, Typography } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const CARDS = [
  {
    emoji: '🏋️',
    title: 'Track every rep',
    subtitle: 'Log weight, reps, and rest for every set of every workout.',
  },
  {
    emoji: '📈',
    title: 'See your progress',
    subtitle: 'Charts and personal records show exactly how far you\'ve come.',
  },
  {
    emoji: '🗓️',
    title: 'Stay consistent',
    subtitle: 'Routines keep you on track. Body weight tracking keeps you honest.',
  },
];

function complete() {
  setSetting('onboarding_complete', '1');
  router.replace('/(tabs)/');
}

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
    setIndex(i);
  };

  const handleNext = () => {
    if (index < CARDS.length - 1) {
      goTo(index + 1);
    } else {
      complete();
    }
  };

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <View style={styles.topBar}>
        {index < CARDS.length - 1 ? (
          <Pressable
            style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
            onPress={complete}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      {/* Cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scroll}
      >
        {CARDS.map((card, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.emoji}>{card.emoji}</Text>
            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.subtitle}>{card.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {CARDS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>

      {/* Button */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>
            {index < CARDS.length - 1 ? 'Next' : 'Get Started'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.lg,
  },
  skipBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  skipBtnPressed: { opacity: 0.7 },
  skipText: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  scroll: {
    flex: 1,
  },
  card: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  emoji: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.size.xxl,
    fontWeight: Typography.weight.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  nextBtnPressed: { opacity: 0.85 },
  nextText: {
    color: Colors.background,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
});
