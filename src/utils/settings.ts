import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  LOW_STOCK_THRESHOLD: 'setting:lowStockThreshold',
  AUTO_REFRESH_INTERVAL: 'setting:autoRefreshInterval',
  SESSION_TIMEOUT: 'setting:sessionTimeout',
  BIOMETRIC_ENABLED: 'setting:biometricEnabled',
  NOTIFICATION_HOUR: 'setting:notificationHour',
  NOTIFY_AP_OVERDUE: 'setting:notifyApOverdue',
  NOTIFY_AR_OVERDUE: 'setting:notifyArOverdue',
  NOTIFY_LOW_STOCK: 'setting:notifyLowStock',
  NOTIFY_DUE_SOON: 'setting:notifyDueSoon',
  DUE_SOON_DAYS: 'setting:dueSoonDays',
  DATE_FORMAT: 'setting:dateFormat',
  NOTIFY_PO_DELIVERY: 'setting:notifyPoDelivery',
  PO_DELIVERY_DAYS: 'setting:poDeliveryDays',
};

export type DateFormat = 'natural' | 'dmy' | 'mdy';

// Module-level cache so formatDate() can call it synchronously.
let _dateFormatCache: DateFormat = 'natural';

export function getDateFormatSync(): DateFormat {
  return _dateFormatCache;
}

export async function initDateFormat(): Promise<void> {
  _dateFormatCache = await getDateFormat();
}

export async function getDateFormat(): Promise<DateFormat> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DATE_FORMAT);
    if (raw === 'dmy' || raw === 'mdy') return raw;
    return 'natural';
  } catch {
    return 'natural';
  }
}

export async function setDateFormat(fmt: DateFormat): Promise<void> {
  _dateFormatCache = fmt;
  await AsyncStorage.setItem(KEYS.DATE_FORMAT, fmt);
}

const DEFAULTS = {
  lowStockThreshold: 100,
  autoRefreshInterval: 0, // 0 = off
  sessionTimeout: 0, // 0 = off, else minutes
  notificationHour: 9,
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

/** Returns the session timeout in minutes (0 = disabled). */
export async function getSessionTimeout(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSION_TIMEOUT);
    if (raw === null) return DEFAULTS.sessionTimeout;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 ? DEFAULTS.sessionTimeout : n;
  } catch {
    return DEFAULTS.sessionTimeout;
  }
}

export async function setSessionTimeout(minutes: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.SESSION_TIMEOUT, String(Math.max(0, minutes)));
}

export async function getBiometricEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BIOMETRIC_ENABLED);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
}

/** Returns the hour (0–23) at which the daily overdue reminder fires. Default: 9. */
export async function getNotificationHour(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFICATION_HOUR);
    if (raw === null) return DEFAULTS.notificationHour;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 || n > 23 ? DEFAULTS.notificationHour : n;
  } catch {
    return DEFAULTS.notificationHour;
  }
}

export async function setNotificationHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFICATION_HOUR, String(Math.min(23, Math.max(0, hour))));
}

/** Returns whether the AP overdue alert type triggers a notification. Default: true. */
export async function getNotifyApOverdue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFY_AP_OVERDUE);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setNotifyApOverdue(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFY_AP_OVERDUE, enabled ? 'true' : 'false');
}

/** Returns whether the AR overdue alert type triggers a notification. Default: true. */
export async function getNotifyArOverdue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFY_AR_OVERDUE);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setNotifyArOverdue(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFY_AR_OVERDUE, enabled ? 'true' : 'false');
}

/** Returns whether the low-stock alert type triggers a notification. Default: true. */
export async function getNotifyLowStock(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFY_LOW_STOCK);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setNotifyLowStock(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFY_LOW_STOCK, enabled ? 'true' : 'false');
}

/** Returns whether "due soon" bills/invoices trigger a notification. Default: true. */
export async function getNotifyDueSoon(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFY_DUE_SOON);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setNotifyDueSoon(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFY_DUE_SOON, enabled ? 'true' : 'false');
}

/** Returns the "due soon" window in days (items due within this many days). Default: 7. */
export async function getDueSoonDays(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DUE_SOON_DAYS);
    if (raw === null) return 7;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 1 ? 7 : n;
  } catch {
    return 7;
  }
}

export async function setDueSoonDays(days: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.DUE_SOON_DAYS, String(Math.max(1, days)));
}

/** Returns whether PO delivery approaching notifications are enabled. Default: true. */
export async function getNotifyPoDelivery(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFY_PO_DELIVERY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setNotifyPoDelivery(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFY_PO_DELIVERY, enabled ? 'true' : 'false');
}

/** Returns days before delivery date to trigger the notification. Default: 3. */
export async function getPoDeliveryDays(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PO_DELIVERY_DAYS);
    if (raw === null) return 3;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 1 ? 3 : n;
  } catch {
    return 3;
  }
}

export async function setPoDeliveryDays(days: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.PO_DELIVERY_DAYS, String(Math.max(1, days)));
}

const ITEM_THRESHOLD_PREFIX = 'setting:itemThreshold:';

/** Returns the per-item threshold for a specific item, or null if not set. */
export async function getItemThreshold(itemName: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(ITEM_THRESHOLD_PREFIX + itemName);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 ? null : n;
  } catch {
    return null;
  }
}

/** Sets a per-item threshold. Pass null to clear (revert to global). */
export async function setItemThreshold(itemName: string, threshold: number | null): Promise<void> {
  try {
    if (threshold === null) {
      await AsyncStorage.removeItem(ITEM_THRESHOLD_PREFIX + itemName);
    } else {
      await AsyncStorage.setItem(ITEM_THRESHOLD_PREFIX + itemName, String(Math.max(0, threshold)));
    }
  } catch {}
}

/** Loads all per-item thresholds into a Map<itemName, threshold>. */
export async function loadAllItemThresholds(): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const itemKeys = allKeys.filter((k) => k.startsWith(ITEM_THRESHOLD_PREFIX));
    if (itemKeys.length === 0) return result;
    const pairs = await AsyncStorage.multiGet(itemKeys);
    for (const [key, val] of pairs) {
      if (!val) continue;
      const name = key.slice(ITEM_THRESHOLD_PREFIX.length);
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) result.set(name, n);
    }
  } catch {}
  return result;
}
