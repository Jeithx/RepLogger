import { getDatabase } from './database';
import { BodyWeightEntry, BodyWeightStats } from '../types';

// ─── Write ─────────────────────────────────────────────────────────────────

export function insertBodyWeight(weightKg: number, notes?: string): number {
  try {
    const db = getDatabase();
    const result = db.runSync(
      'INSERT INTO body_weight_entries (weight_kg, notes) VALUES (?, ?);',
      [weightKg, notes ?? null]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('insertBodyWeight failed:', error);
    throw error;
  }
}

// Backwards-compat alias used in existing screens
export function addBodyWeightEntry(weightKg: number, notes: string | null = null): number {
  return insertBodyWeight(weightKg, notes ?? undefined);
}

export function deleteBodyWeightEntry(id: number): void {
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM body_weight_entries WHERE id = ?;', [id]);
  } catch (error) {
    console.error('deleteBodyWeightEntry failed:', error);
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────

export function getBodyWeightEntries(limit: number, offset: number): BodyWeightEntry[] {
  try {
    const db = getDatabase();
    return db.getAllSync<BodyWeightEntry>(
      'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC LIMIT ? OFFSET ?;',
      [limit, offset]
    );
  } catch (error) {
    console.error('getBodyWeightEntries failed:', error);
    return [];
  }
}

export function getBodyWeightRange(startDate: string, endDate: string): BodyWeightEntry[] {
  try {
    const db = getDatabase();
    return db.getAllSync<BodyWeightEntry>(
      `SELECT * FROM body_weight_entries
       WHERE substr(recorded_at, 1, 10) >= ? AND substr(recorded_at, 1, 10) <= ?
       ORDER BY recorded_at ASC;`,
      [startDate, endDate]
    );
  } catch (error) {
    console.error('getBodyWeightRange failed:', error);
    return [];
  }
}

export function getLatestBodyWeight(): BodyWeightEntry | null {
  try {
    const db = getDatabase();
    return db.getFirstSync<BodyWeightEntry>(
      'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC LIMIT 1;'
    );
  } catch (error) {
    console.error('getLatestBodyWeight failed:', error);
    return null;
  }
}

// Backwards-compat alias
export function getLatestBodyWeightEntry(): BodyWeightEntry | null {
  return getLatestBodyWeight();
}

export function getAllBodyWeightEntries(): BodyWeightEntry[] {
  try {
    const db = getDatabase();
    return db.getAllSync<BodyWeightEntry>(
      'SELECT * FROM body_weight_entries ORDER BY recorded_at DESC;'
    );
  } catch (error) {
    console.error('getAllBodyWeightEntries failed:', error);
    return [];
  }
}

// ─── Moving average ────────────────────────────────────────────────────────

export function getMovingAverage(days: number): { date: string; average: number }[] {
  try {
    const db = getDatabase();
    const rows = db.getAllSync<{ weight_kg: number; recorded_at: string }>(
      'SELECT weight_kg, recorded_at FROM body_weight_entries ORDER BY recorded_at ASC;'
    );
    if (rows.length === 0) return [];

    return rows.map((_, i) => {
      const windowStart = Math.max(0, i - days + 1);
      const window = rows.slice(windowStart, i + 1);
      const avg = window.reduce((sum, r) => sum + r.weight_kg, 0) / window.length;
      return { date: rows[i].recorded_at, average: Math.round(avg * 10) / 10 };
    });
  } catch (error) {
    console.error('getMovingAverage failed:', error);
    return [];
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export function getBodyWeightStats(): BodyWeightStats {
  try {
    const db = getDatabase();
    const rows = db.getAllSync<{ weight_kg: number; recorded_at: string }>(
      'SELECT weight_kg, recorded_at FROM body_weight_entries ORDER BY recorded_at ASC;'
    );

    if (rows.length === 0) {
      return {
        current: null,
        sevenDayAvg: null,
        thirtyDayAvg: null,
        allTimeMin: null,
        allTimeMax: null,
        totalEntries: 0,
        firstEntryDate: null,
      };
    }

    const current = rows[rows.length - 1].weight_kg;
    const recent7 = rows.slice(-7);
    const sevenDayAvg = recent7.reduce((s, r) => s + r.weight_kg, 0) / recent7.length;
    const recent30 = rows.slice(-30);
    const thirtyDayAvg = recent30.reduce((s, r) => s + r.weight_kg, 0) / recent30.length;

    let minRow = rows[0];
    let maxRow = rows[0];
    for (const row of rows) {
      if (row.weight_kg < minRow.weight_kg) minRow = row;
      if (row.weight_kg > maxRow.weight_kg) maxRow = row;
    }

    return {
      current,
      sevenDayAvg: Math.round(sevenDayAvg * 10) / 10,
      thirtyDayAvg: Math.round(thirtyDayAvg * 10) / 10,
      allTimeMin: { weight: minRow.weight_kg, date: minRow.recorded_at },
      allTimeMax: { weight: maxRow.weight_kg, date: maxRow.recorded_at },
      totalEntries: rows.length,
      firstEntryDate: rows[0].recorded_at,
    };
  } catch (error) {
    console.error('getBodyWeightStats failed:', error);
    return {
      current: null,
      sevenDayAvg: null,
      thirtyDayAvg: null,
      allTimeMin: null,
      allTimeMax: null,
      totalEntries: 0,
      firstEntryDate: null,
    };
  }
}
