import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AgingSnapshot {
  ts: string;
  companyId: string;
  apAging: { current: number; days_30: number; days_60: number; days_90: number; over_90: number };
  arAging: { current: number; days_30: number; days_60: number; days_90: number; over_90: number };
}

export interface AgingHistoryEntry {
  date: string; // YYYY-MM-DD
  companyId: string;
  apTotal: number;
  arTotal: number;
  apOver90: number;
  arOver90: number;
}

const KEY_PREFIX = 'aging-snapshot:';
const HISTORY_KEY_PREFIX = 'aging-history:';
const MAX_HISTORY_DAYS = 90;

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

/** Append a daily entry to the rolling 30-day history; skips if same date as last entry. */
export async function saveAgingHistory(entry: AgingHistoryEntry): Promise<void> {
  const history = await loadAgingHistory(entry.companyId);
  if (history.length > 0 && history[history.length - 1].date === entry.date) return;
  history.push(entry);
  if (history.length > MAX_HISTORY_DAYS) history.splice(0, history.length - MAX_HISTORY_DAYS);
  const key = HISTORY_KEY_PREFIX + entry.companyId;
  await AsyncStorage.setItem(key, JSON.stringify(history));
}

export async function loadAgingHistory(companyId: string): Promise<AgingHistoryEntry[]> {
  const key = HISTORY_KEY_PREFIX + companyId;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as AgingHistoryEntry[];
  } catch {
    return [];
  }
}

export function agingDelta(
  current: number | undefined,
  previous: number | undefined,
): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}
