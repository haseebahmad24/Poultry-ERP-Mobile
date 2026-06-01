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
