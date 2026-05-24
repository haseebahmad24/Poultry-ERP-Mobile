import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotificationHour,
  getNotifyApOverdue,
  getNotifyArOverdue,
  getNotifyLowStock,
} from '@/utils/settings';

const KEY_NOTIFICATIONS_ENABLED = 'setting:notificationsEnabled';
const IDENTIFIER_OVERDUE = 'poultry-erp-overdue-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY_NOTIFICATIONS_ENABLED);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  // Use `status` string comparison because the `granted` convenience field isn't
  // always reflected in the TS types due to a re-export gap in this expo version.
  if ((existing as any).status === 'granted' || (existing as any).granted === true) return true;
  const result = await Notifications.requestPermissionsAsync();
  return (result as any).status === 'granted' || (result as any).granted === true;
}

export async function scheduleOverdueReminder(params: {
  apOverdue: number;
  arOverdue: number;
  lowStock: number;
}): Promise<void> {
  const [notifyAP, notifyAR, notifyStock, hour] = await Promise.all([
    getNotifyApOverdue(),
    getNotifyArOverdue(),
    getNotifyLowStock(),
    getNotificationHour(),
  ]);

  const effectiveAP = notifyAP ? params.apOverdue : 0;
  const effectiveAR = notifyAR ? params.arOverdue : 0;
  const effectiveStock = notifyStock ? params.lowStock : 0;
  const total = effectiveAP + effectiveAR + effectiveStock;

  if (total === 0) {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_OVERDUE).catch(() => {});
    return;
  }

  const parts: string[] = [];
  if (effectiveAP > 0) parts.push(`${effectiveAP} overdue bill${effectiveAP > 1 ? 's' : ''}`);
  if (effectiveAR > 0) parts.push(`${effectiveAR} overdue invoice${effectiveAR > 1 ? 's' : ''}`);
  if (effectiveStock > 0) parts.push(`${effectiveStock} low-stock item${effectiveStock > 1 ? 's' : ''}`);

  const body = parts.join(' · ');

  // Schedule for next occurrence of the configured hour
  const trigger = new Date();
  trigger.setHours(hour, 0, 0, 0);
  if (trigger <= new Date()) trigger.setDate(trigger.getDate() + 1);

  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_OVERDUE).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER_OVERDUE,
      content: {
        title: 'Action required',
        body,
        data: { type: 'overdue' },
      },
      trigger: { date: trigger } as any,
    });
  } catch {
    // Scheduling can fail in Expo Go or without valid credentials — ignore silently
  }
}

export async function cancelOverdueReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_OVERDUE).catch(() => {});
}
