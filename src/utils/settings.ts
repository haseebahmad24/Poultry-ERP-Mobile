import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LOW_STOCK_THRESHOLD: 'setting:lowStockThreshold',
};

const DEFAULTS = {
  lowStockThreshold: 100,
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
