import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotificationHour,
  getNotifyApOverdue,
  getNotifyArOverdue,
  getNotifyLowStock,
  getNotifyDueSoon,
} from '@/utils/settings';
import { logNotificationEvent } from '@/utils/notificationLog';

const KEY_NOTIFICATIONS_ENABLED = 'setting:notificationsEnabled';
const IDENTIFIER_OVERDUE = 'poultry-erp-overdue-reminder';
const IDENTIFIER_DUE_SOON = 'poultry-erp-due-soon-reminder';

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
    // Log to in-app inbox every time an overdue reminder is scheduled
    await logNotificationEvent({
      apCount: effectiveAP,
      arCount: effectiveAR,
      stockCount: effectiveStock,
    });
  } catch {
    // Scheduling can fail in Expo Go or without valid credentials — ignore silently
  }
}

export async function cancelOverdueReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_OVERDUE).catch(() => {});
}

export async function scheduleDueSoonReminder(params: {
  apDueSoon: number;
  arDueSoon: number;
}): Promise<void> {
  const [notifyDueSoon, hour] = await Promise.all([
    getNotifyDueSoon(),
    getNotificationHour(),
  ]);

  if (!notifyDueSoon) {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_DUE_SOON).catch(() => {});
    return;
  }

  const total = params.apDueSoon + params.arDueSoon;
  if (total === 0) {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_DUE_SOON).catch(() => {});
    return;
  }

  const parts: string[] = [];
  if (params.apDueSoon > 0)
    parts.push(`${params.apDueSoon} bill${params.apDueSoon > 1 ? 's' : ''} due soon`);
  if (params.arDueSoon > 0)
    parts.push(`${params.arDueSoon} invoice${params.arDueSoon > 1 ? 's' : ''} due soon`);

  // Schedule for the morning after the overdue reminder (30 min later) so they don't fire at the same time
  const trigger = new Date();
  trigger.setHours(hour, 30, 0, 0);
  if (trigger <= new Date()) trigger.setDate(trigger.getDate() + 1);

  try {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_DUE_SOON).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFIER_DUE_SOON,
      content: {
        title: 'Upcoming payments',
        body: parts.join(' · '),
        data: { type: 'due-soon' },
      },
      trigger: { date: trigger } as any,
    });
  } catch {
    // Ignore scheduling failures in Expo Go / without credentials
  }
}

export async function cancelDueSoonReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_DUE_SOON).catch(() => {});
}
