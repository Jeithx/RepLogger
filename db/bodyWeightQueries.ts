import { getDatabase } from './database';
import { BodyWeightEntry } from '../types';

export function addBodyWeightEntry(weightKg: number, notes: string | null = null): number {
  const db = getDatabase();
  const result = db.runSync(
    'INSERT INTO body_weight_entries (weight_kg, notes) VALUES (?, ?);',
    [weightKg, notes]
  );
  return result.lastInsertRowId;
}

export function getAllBodyWeightEntries(): BodyWeightEntry[] {
  const db = getDatabase();
  return db.getAllSync<BodyWeightEntry>(
    'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC;'
  );
}

export function getLatestBodyWeightEntry(): BodyWeightEntry | null {
  const db = getDatabase();
  return db.getFirstSync<BodyWeightEntry>(
    'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC LIMIT 1;'
  );
}

export function deleteBodyWeightEntry(id: number): void {
  const db = getDatabase();
  db.runSync('DELETE FROM body_weight_entries WHERE id = ?;', [id]);
}
