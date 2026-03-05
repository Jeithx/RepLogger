import * as SQLite from 'expo-sqlite';
import { MuscleGroup } from '../types';

const DB_NAME = 'hrmetrics.db';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitialized = false;

export function isDbReady(): boolean {
  return dbInitialized;
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const database = getDatabase();

  database.execSync(`PRAGMA journal_mode = WAL;`);
  database.execSync(`PRAGMA foreign_keys = ON;`);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      days_per_week INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS routine_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
      day_order INTEGER NOT NULL,
      name TEXT NOT NULL
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS routine_day_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      order_index INTEGER NOT NULL,
      target_sets INTEGER NOT NULL DEFAULT 3,
      target_reps INTEGER NOT NULL DEFAULT 10,
      target_weight REAL NOT NULL DEFAULT 0
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_day_id INTEGER REFERENCES routine_days(id),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      notes TEXT
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      set_number INTEGER NOT NULL,
      weight_kg REAL NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      rpe REAL
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS body_weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      weight_kg REAL NOT NULL,
      reps INTEGER NOT NULL,
      estimated_1rm REAL NOT NULL,
      achieved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS water_intake_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_ml INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      notes TEXT
    );
  `);

  await seedExercisesIfEmpty(database);
  seedSettingsIfEmpty(database);
  dbInitialized = true;
}

function seedSettingsIfEmpty(database: SQLite.SQLiteDatabase): void {
  const defaults: { key: string; value: string }[] = [
    { key: 'rest_timer_seconds', value: '90' },
    { key: 'weight_unit', value: 'kg' },
    { key: 'active_routine_id', value: '' },
    { key: 'last_used_routine_day_id', value: '' },
    { key: 'current_phase', value: '' },
    { key: 'phase_start_date', value: '' },
    { key: 'phase_goal_weight', value: '' },
    { key: 'daily_water_goal_ml', value: '2500' },
    { key: 'water_unit', value: 'ml' },
  ];
  for (const row of defaults) {
    database.runSync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING;',
      [row.key, row.value]
    );
  }
}

const SEED_EXERCISES: { name: string; muscle_group: MuscleGroup }[] = [
  // Chest
  { name: 'Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'Incline Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'Decline Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'DB Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'Incline DB Press', muscle_group: MuscleGroup.Chest },
  { name: 'DB Fly', muscle_group: MuscleGroup.Chest },
  { name: 'Cable Fly', muscle_group: MuscleGroup.Chest },
  { name: 'Cable Crossover', muscle_group: MuscleGroup.Chest },
  { name: 'Pec Deck', muscle_group: MuscleGroup.Chest },
  { name: 'Chest Press Machine', muscle_group: MuscleGroup.Chest },
  { name: 'Push-ups', muscle_group: MuscleGroup.Chest },
  { name: 'Dips', muscle_group: MuscleGroup.Chest },

  // Back
  { name: 'Deadlift', muscle_group: MuscleGroup.Back },
  { name: 'Sumo Deadlift', muscle_group: MuscleGroup.Back },
  { name: 'Pull-ups', muscle_group: MuscleGroup.Back },
  { name: 'Chin-ups', muscle_group: MuscleGroup.Back },
  { name: 'Barbell Row', muscle_group: MuscleGroup.Back },
  { name: 'T-Bar Row', muscle_group: MuscleGroup.Back },
  { name: 'DB Row', muscle_group: MuscleGroup.Back },
  { name: 'Single-Arm DB Row', muscle_group: MuscleGroup.Back },
  { name: 'Chest-Supported Row', muscle_group: MuscleGroup.Back },
  { name: 'Lat Pulldown', muscle_group: MuscleGroup.Back },
  { name: 'Wide-Grip Pulldown', muscle_group: MuscleGroup.Back },
  { name: 'Cable Row', muscle_group: MuscleGroup.Back },
  { name: 'Straight-Arm Pulldown', muscle_group: MuscleGroup.Back },
  { name: 'Hyperextension', muscle_group: MuscleGroup.Back },

  // Legs
  { name: 'Squat', muscle_group: MuscleGroup.Legs },
  { name: 'Front Squat', muscle_group: MuscleGroup.Legs },
  { name: 'Hack Squat', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Press', muscle_group: MuscleGroup.Legs },
  { name: 'Bulgarian Split Squat', muscle_group: MuscleGroup.Legs },
  { name: 'Lunges', muscle_group: MuscleGroup.Legs },
  { name: 'Step-ups', muscle_group: MuscleGroup.Legs },
  { name: 'Romanian Deadlift', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Curl', muscle_group: MuscleGroup.Legs },
  { name: 'Nordic Curl', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Extension', muscle_group: MuscleGroup.Legs },
  { name: 'Hip Thrust', muscle_group: MuscleGroup.Legs },
  { name: 'Glute Bridge', muscle_group: MuscleGroup.Legs },
  { name: 'Calf Raise', muscle_group: MuscleGroup.Legs },
  { name: 'Seated Calf Raise', muscle_group: MuscleGroup.Legs },

  // Shoulders
  { name: 'Overhead Press', muscle_group: MuscleGroup.Shoulders },
  { name: 'DB Shoulder Press', muscle_group: MuscleGroup.Shoulders },
  { name: 'Arnold Press', muscle_group: MuscleGroup.Shoulders },
  { name: 'Machine Shoulder Press', muscle_group: MuscleGroup.Shoulders },
  { name: 'Lateral Raise', muscle_group: MuscleGroup.Shoulders },
  { name: 'Cable Lateral Raise', muscle_group: MuscleGroup.Shoulders },
  { name: 'Front Raise', muscle_group: MuscleGroup.Shoulders },
  { name: 'Rear Delt Fly', muscle_group: MuscleGroup.Shoulders },
  { name: 'Face Pull', muscle_group: MuscleGroup.Shoulders },
  { name: 'Upright Row', muscle_group: MuscleGroup.Shoulders },

  // Arms
  { name: 'Barbell Curl', muscle_group: MuscleGroup.Arms },
  { name: 'EZ Bar Curl', muscle_group: MuscleGroup.Arms },
  { name: 'DB Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Hammer Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Preacher Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Concentration Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Incline DB Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Cable Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Reverse Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Tricep Pushdown', muscle_group: MuscleGroup.Arms },
  { name: 'Skull Crushers', muscle_group: MuscleGroup.Arms },
  { name: 'Overhead Tricep Extension', muscle_group: MuscleGroup.Arms },
  { name: 'Tricep Kickback', muscle_group: MuscleGroup.Arms },
  { name: 'Close-Grip Bench Press', muscle_group: MuscleGroup.Arms },

  // Core
  { name: 'Plank', muscle_group: MuscleGroup.Core },
  { name: 'Side Plank', muscle_group: MuscleGroup.Core },
  { name: 'Cable Crunch', muscle_group: MuscleGroup.Core },
  { name: 'Crunches', muscle_group: MuscleGroup.Core },
  { name: 'Sit-ups', muscle_group: MuscleGroup.Core },
  { name: 'Bicycle Crunch', muscle_group: MuscleGroup.Core },
  { name: 'Hanging Leg Raise', muscle_group: MuscleGroup.Core },
  { name: 'Ab Wheel Rollout', muscle_group: MuscleGroup.Core },
  { name: 'Russian Twist', muscle_group: MuscleGroup.Core },
  { name: 'Dead Bug', muscle_group: MuscleGroup.Core },
  { name: 'Dragon Flag', muscle_group: MuscleGroup.Core },
];

async function seedExercisesIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises;'
  );

  if (result && result.count > 0) {
    // Table already has data — run migration to add any new exercises
    migrateExercises(database);
    return;
  }

  const insertStmt = database.prepareSync(
    'INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 0);'
  );

  try {
    for (const exercise of SEED_EXERCISES) {
      insertStmt.executeSync([exercise.name, exercise.muscle_group]);
    }
  } finally {
    insertStmt.finalizeSync();
  }
}

function migrateExercises(database: SQLite.SQLiteDatabase): void {
  const insertStmt = database.prepareSync(
    `INSERT INTO exercises (name, muscle_group, is_custom)
     SELECT ?, ?, 0 WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name = ?);`
  );
  try {
    for (const exercise of SEED_EXERCISES) {
      insertStmt.executeSync([exercise.name, exercise.muscle_group, exercise.name]);
    }
  } finally {
    insertStmt.finalizeSync();
  }
}
