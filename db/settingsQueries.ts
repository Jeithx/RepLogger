import { getDatabase } from './database';
import { WorkoutPhase, PhaseInfo } from '../types';

export function getSetting(key: string): string | null {
  try {
    const db = getDatabase();
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [key]
    );
    return row?.value ?? null;
  } catch (error) {
    console.error(`getSetting(${key}) failed:`, error);
    return null;
  }
}

export function setSetting(key: string, value: string): void {
  try {
    const db = getDatabase();
    db.runSync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
      [key, value]
    );
  } catch (error) {
    console.error(`setSetting(${key}) failed:`, error);
  }
}

export function setPhase(phase: WorkoutPhase | '', goalWeight?: number): void {
  setSetting('current_phase', phase);
  setSetting('phase_start_date', phase ? new Date().toISOString().slice(0, 10) : '');
  setSetting('phase_goal_weight', goalWeight != null ? String(goalWeight) : '');
}

export function getPhaseInfo(): PhaseInfo | null {
  const phase = getSetting('current_phase') ?? '';
  if (!phase) return null;
  const startDate = getSetting('phase_start_date') ?? '';
  const goalStr = getSetting('phase_goal_weight');
  const goalWeight = goalStr ? parseFloat(goalStr) : null;
  return { phase: phase as WorkoutPhase, startDate, goalWeight };
}
