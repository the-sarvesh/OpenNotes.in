import db from "../db/database.js";

interface SettingCache {
  value: string;
  timestamp: number;
}

const cache = new Map<string, SettingCache>();
const CACHE_TTL = 30 * 1000; // 30 seconds

export const getSetting = async (key: string, defaultValue: string = ""): Promise<string> => {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.value;
  }

  try {
    const result = await db.execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: [key],
    });

    const value = result.rows[0] ? String(result.rows[0].value) : defaultValue;
    cache.set(key, { value, timestamp: now });
    return value;
  } catch (error) {
    console.error(`[Settings] Failed to fetch key "${key}":`, error);
    return defaultValue;
  }
};

export const updateSetting = async (key: string, value: string): Promise<void> => {
  try {
    await db.execute({
      sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      args: [key, value],
    });
    cache.set(key, { value, timestamp: Date.now() });
  } catch (error) {
    console.error(`[Settings] Failed to update key "${key}":`, error);
    throw error;
  }
};

export const clearSettingCache = (key?: string) => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};
