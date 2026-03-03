import { getDatabase } from './database';

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
