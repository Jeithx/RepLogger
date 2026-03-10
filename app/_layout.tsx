import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { initializeDatabase } from '../db/database';
import { getSetting } from '../db/settingsQueries';
import { useRoutineStore } from '../store/useRoutineStore';
import { useWaterStore } from '../store/useWaterStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useInsightStore } from '../store/useInsightStore';
import { requestPermissions } from '../utils/notificationService';
import { Colors } from '../constants/theme';
import Toast from '../components/Toast';

export default function RootLayout() {
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const loadTodaysDay = useRoutineStore((s) => s.loadTodaysDay);
  const loadWaterToday = useWaterStore((s) => s.loadToday);
  const loadWaterSettings = useWaterStore((s) => s.loadSettings);
  const loadExercises = useExerciseStore((s) => s.loadExercises);
  const generateInsights = useInsightStore((s) => s.generateAndLoad);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        loadWaterSettings();
        loadWaterToday();
        loadExercises();
        const done = getSetting('onboarding_complete');
        if (done !== '1') {
          router.replace('/onboarding');
        } else {
          loadRoutines();
          loadTodaysDay();
          generateInsights();
        }

        // Request notification permissions once on first launch
        const permAsked = getSetting('notifications_permission_asked');
        if (permAsked !== '1') {
          requestPermissions().catch(() => { });
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize database:', error);
      });

    // Handle notification tap — navigate to the relevant screen
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const id = response.notification.request.identifier;
        if (id === 'workout-active-ongoing') {
          router.push('/workout/active');
        } else if (id.startsWith('rest-timer')) {
          router.push('/workout/active');
        } else if (id.startsWith('workout-')) {
          router.push('/(tabs)');
        } else if (id.startsWith('water-')) {
          router.push('/water');
        } else if (id.startsWith('weight')) {
          router.push('/bodyweight');
        }
      });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/summary" />
        <Stack.Screen name="routines/builder" />
        <Stack.Screen name="routines/day-editor" />
        <Stack.Screen name="routines/[id]" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="bodyweight/index" />
        <Stack.Screen name="water/index" />
        <Stack.Screen name="exercises/index" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="rex" />
      </Stack>
      <Toast />
    </GestureHandlerRootView>
  );
}

