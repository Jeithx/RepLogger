# HRmetrics

A minimalist, fully offline workout tracking app built with React Native and Expo.

## Features

- **Active Workout Tracking** — Log sets with weight and reps in real time. Drag to reorder exercises, mark sets complete with haptic feedback, and rest between sets with a built-in countdown timer.
- **Routine Management** — Create structured training programs from templates (PPL, Upper/Lower, Full Body, StrongLifts 5×5) or from scratch. Routines cycle automatically through training days.
- **History & Progress** — Browse your full workout log with swipe-to-delete. View estimated 1RM progress charts per exercise. Track personal records grouped by muscle group.
- **Body Weight Tracking** — Log daily weight with an SVG chart showing raw entries, a 7-day moving average, a goal weight line, and phase start markers. Supports Cut / Bulk / Maintain phases.
- **Personal Records** — Automatically detected using the Epley formula on every completed set. PRs surface in a post-workout overlay and in the Records tab.
- **Weight Unit Support** — Switch between kg and lbs in Settings. All weights are stored internally in kg and converted at display time.
- **CSV Export** — Export workout sets or body weight history as CSV files via the system share sheet.
- **Onboarding** — Three-card swipeable introduction shown on first launch.

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native 0.83 + Expo SDK 55 |
| Navigation | Expo Router (file-based) |
| Database | expo-sqlite (synchronous API) |
| State | Zustand 5 |
| Animations | react-native-reanimated 4 |
| Charts | react-native-svg |
| Gestures | react-native-gesture-handler + react-native-draggable-flatlist |
| Haptics | expo-haptics |
| Export | expo-file-system + expo-sharing |

## Getting Started

```bash
npm install
npx expo start
```

Open in Expo Go or run on a simulator. No backend, no network calls required — everything is stored on-device via SQLite.

## Project Structure

```
app/
  (tabs)/
    index.tsx          # Home: today's workout card, body weight, week stats
    routines.tsx       # Routine list
    history.tsx        # Workouts / Progress / Records tabs
    settings.tsx       # Weight unit, rest timer, CSV export, data management
  workout/
    active.tsx         # Active workout screen
    summary.tsx        # Post-workout summary with PR overlay
  routines/
    builder.tsx        # New routine wizard
    day-editor.tsx     # Exercise editor for a routine day
    [id].tsx           # Routine detail / edit
  history/
    [id].tsx           # Workout detail view
  bodyweight/
    index.tsx          # Body weight chart and log
  onboarding.tsx       # First-launch walkthrough
  _layout.tsx          # Root stack, DB init, onboarding gate

components/
  ExercisePicker.tsx   # Searchable exercise modal
  RestTimer.tsx        # Countdown overlay with ring animation
  SkeletonLoader.tsx   # Shimmer loading placeholders
  PROverlay.tsx        # New PR celebration overlay
  StatsOverview.tsx    # Weekly stats cards
  WeeklyVolumeChart.tsx
  MuscleGroupChart.tsx
  PhaseSelector.tsx

db/
  database.ts          # Schema, seeding, initialization
  workoutQueries.ts
  routineQueries.ts
  historyQueries.ts
  bodyWeightQueries.ts
  settingsQueries.ts
  exportQueries.ts

store/
  useWorkoutStore.ts
  useRoutineStore.ts
  useHistoryStore.ts
  useBodyWeightStore.ts

utils/
  weightUtils.ts       # Unit conversion (kg ↔ lbs)

constants/
  theme.ts             # Colors, spacing, typography
  routineTemplates.ts  # Built-in program templates
```

## Data Model

All data is stored in a local SQLite database. No account or network access required.

**Tables:** `exercises`, `routines`, `routine_days`, `routine_day_exercises`, `workouts`, `workout_sets`, `body_weight_entries`, `personal_records`, `app_settings`

Personal records are computed using the **Epley formula**: `estimated 1RM = weight × (1 + reps / 30)`

## License

MIT
