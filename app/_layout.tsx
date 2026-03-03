import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from '../db/database';
import { useRoutineStore } from '../store/useRoutineStore';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  const loadRoutines = useRoutineStore((s) => s.loadRoutines);
  const loadTodaysDay = useRoutineStore((s) => s.loadTodaysDay);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        loadRoutines();
        loadTodaysDay();
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize database:', error);
      });
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/active" />
        <Stack.Screen name="workout/summary" />
        <Stack.Screen name="routines/builder" />
        <Stack.Screen name="routines/day-editor" />
        <Stack.Screen name="routines/[id]" />
        <Stack.Screen name="history/[id]" />
      </Stack>
    </>
  );
}
