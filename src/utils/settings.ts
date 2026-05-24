import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LOW_STOCK_THRESHOLD: 'setting:lowStockThreshold',
  AUTO_REFRESH_INTERVAL: 'setting:autoRefreshInterval',
};

const DEFAULTS = {
  lowStockThreshold: 100,
  autoRefreshInterval: 0, // 0 = off
};

export async function getLowStockThreshold(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LOW_STOCK_THRESHOLD);
    if (raw === null) return DEFAULTS.lowStockThreshold;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 1 ? DEFAULTS.lowStockThreshold : n;
  } catch {
    return DEFAULTS.lowStockThreshold;
  }
}

export async function setLowStockThreshold(value: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOW_STOCK_THRESHOLD, String(Math.max(1, value)));
}

/** Returns the auto-refresh interval in minutes (0 = disabled). */
export async function getAutoRefreshInterval(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.AUTO_REFRESH_INTERVAL);
    if (raw === null) return DEFAULTS.autoRefreshInterval;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 ? DEFAULTS.autoRefreshInterval : n;
  } catch {
    return DEFAULTS.autoRefreshInterval;
  }
}

export async function setAutoRefreshInterval(minutes: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.AUTO_REFRESH_INTERVAL, String(Math.max(0, minutes)));
}
