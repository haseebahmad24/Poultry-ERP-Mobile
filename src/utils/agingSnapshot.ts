import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AgingSnapshot {
  ts: string;
  companyId: string;
  apAging: { current: number; days_30: number; days_60: number; days_90: number; over_90: number };
  arAging: { current: number; days_30: number; days_60: number; days_90: number; over_90: number };
}

const KEY_PREFIX = 'aging-snapshot:';

/** Save a snapshot, but only overwrite if the previous one is from a different calendar day. */
export async function saveAgingSnapshot(snapshot: AgingSnapshot): Promise<void> {
  const key = KEY_PREFIX + snapshot.companyId;
  const prev = await loadAgingSnapshot(snapshot.companyId);
  if (prev) {
    const prevDay = prev.ts.slice(0, 10);
    const todayDay = snapshot.ts.slice(0, 10);
    if (prevDay === todayDay) return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(snapshot));
}

export async function loadAgingSnapshot(companyId: string): Promise<AgingSnapshot | null> {
  const key = KEY_PREFIX + companyId;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AgingSnapshot;
  } catch {
    return null;
  }
}

export function agingDelta(
  current: number | undefined,
  previous: number | undefined,
): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}
