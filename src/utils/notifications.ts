import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const { apOverdue, arOverdue, lowStock } = params;
  const total = apOverdue + arOverdue + lowStock;
  if (total === 0) {
    await Notifications.cancelScheduledNotificationAsync(IDENTIFIER_OVERDUE).catch(() => {});
    return;
  }

  const parts: string[] = [];
  if (apOverdue > 0) parts.push(`${apOverdue} overdue bill${apOverdue > 1 ? 's' : ''}`);
  if (arOverdue > 0) parts.push(`${arOverdue} overdue invoice${arOverdue > 1 ? 's' : ''}`);
  if (lowStock > 0) parts.push(`${lowStock} low-stock item${lowStock > 1 ? 's' : ''}`);

  const body = parts.join(' · ');

  // Schedule for next occurrence of 9 AM
  const trigger = new Date();
  trigger.setHours(9, 0, 0, 0);
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
