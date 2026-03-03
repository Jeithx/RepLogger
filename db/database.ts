import * as SQLite from 'expo-sqlite';
import { MuscleGroup } from '../types';

const DB_NAME = 'replogger.db';

let db: SQLite.SQLiteDatabase | null = null;

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

  await seedExercisesIfEmpty(database);
  seedSettingsIfEmpty(database);
}

function seedSettingsIfEmpty(database: SQLite.SQLiteDatabase): void {
  const defaults: { key: string; value: string }[] = [
    { key: 'rest_timer_seconds', value: '90' },
    { key: 'weight_unit', value: 'kg' },
    { key: 'active_routine_id', value: '' },
    { key: 'last_used_routine_day_id', value: '' },
  ];
  for (const row of defaults) {
    database.runSync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING;',
      [row.key, row.value]
    );
  }
}

const SEED_EXERCISES: { name: string; muscle_group: MuscleGroup }[] = [
  { name: 'Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'Incline Bench Press', muscle_group: MuscleGroup.Chest },
  { name: 'Cable Fly', muscle_group: MuscleGroup.Chest },
  { name: 'Dips', muscle_group: MuscleGroup.Chest },

  { name: 'Deadlift', muscle_group: MuscleGroup.Back },
  { name: 'Pull-ups', muscle_group: MuscleGroup.Back },
  { name: 'Barbell Row', muscle_group: MuscleGroup.Back },
  { name: 'Lat Pulldown', muscle_group: MuscleGroup.Back },
  { name: 'Cable Row', muscle_group: MuscleGroup.Back },

  { name: 'Squat', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Press', muscle_group: MuscleGroup.Legs },
  { name: 'Romanian Deadlift', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Curl', muscle_group: MuscleGroup.Legs },
  { name: 'Leg Extension', muscle_group: MuscleGroup.Legs },
  { name: 'Calf Raise', muscle_group: MuscleGroup.Legs },

  { name: 'Overhead Press', muscle_group: MuscleGroup.Shoulders },
  { name: 'Lateral Raise', muscle_group: MuscleGroup.Shoulders },
  { name: 'Face Pull', muscle_group: MuscleGroup.Shoulders },

  { name: 'Barbell Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Hammer Curl', muscle_group: MuscleGroup.Arms },
  { name: 'Tricep Pushdown', muscle_group: MuscleGroup.Arms },
  { name: 'Skull Crushers', muscle_group: MuscleGroup.Arms },

  { name: 'Plank', muscle_group: MuscleGroup.Core },
  { name: 'Cable Crunch', muscle_group: MuscleGroup.Core },
  { name: 'Hanging Leg Raise', muscle_group: MuscleGroup.Core },
];

async function seedExercisesIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = database.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises;'
  );

  if (result && result.count > 0) {
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
