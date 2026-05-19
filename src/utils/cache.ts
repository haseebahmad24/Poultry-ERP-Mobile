import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_VERSION = '1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

export async function getCached<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;
    const age = Date.now() - entry.timestamp;
    return { data: entry.data, stale: age > MAX_AGE_MS };
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), version: CACHE_VERSION };
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch {
    // ignore write failures silently
  }
}

export async function clearCache(keyPrefix?: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toDelete = keys.filter((k) =>
      keyPrefix ? k.startsWith(`cache:${keyPrefix}`) : k.startsWith('cache:')
    );
    if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
  } catch {
    // ignore
  }
}
