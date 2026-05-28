import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentItemType = 'po' | 'so' | 'partner' | 'material' | 'vendor' | 'customer';

export type RecentItem = {
  id: string;
  type: RecentItemType;
  title: string;
  subtitle?: string;
  entityId: string | number;
  viewedAt: number;
  navParams?: Record<string, unknown>;
};

const KEY = 'recently_viewed';
const MAX = 8;

export async function addRecentlyViewed(item: Omit<RecentItem, 'viewedAt'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    let list: RecentItem[] = raw ? JSON.parse(raw) : [];
    // remove duplicate
    list = list.filter((x) => !(x.type === item.type && String(x.entityId) === String(item.entityId)));
    list.unshift({ ...item, viewedAt: Date.now() });
    if (list.length > MAX) list = list.slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export async function getRecentlyViewed(): Promise<RecentItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearRecentlyViewed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
