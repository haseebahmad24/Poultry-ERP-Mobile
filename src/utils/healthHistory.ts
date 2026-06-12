import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HealthHistoryEntry {
  date: string; // YYYY-MM-DD
  companyId: string;
  score: number;     // 0–100 composite score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  apPct: number;
  arPct: number;
}

const HEALTH_KEY_PREFIX = 'health-history:';
const MAX_ENTRIES = 30;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveHealthSnapshot(
  companyId: string | number | undefined,
  entry: Omit<HealthHistoryEntry, 'date' | 'companyId'>,
): Promise<void> {
  const cid = String(companyId ?? 'all');
  const history = await loadHealthHistory(companyId);
  const today = todayISO();
  if (history.length > 0 && history[history.length - 1].date === today) {
    history[history.length - 1] = { date: today, companyId: cid, ...entry };
  } else {
    history.push({ date: today, companyId: cid, ...entry });
    if (history.length > MAX_ENTRIES) {
      history.splice(0, history.length - MAX_ENTRIES);
    }
  }
  await AsyncStorage.setItem(HEALTH_KEY_PREFIX + cid, JSON.stringify(history));
}

export async function loadHealthHistory(
  companyId: string | number | undefined,
): Promise<HealthHistoryEntry[]> {
  const cid = String(companyId ?? 'all');
  try {
    const raw = await AsyncStorage.getItem(HEALTH_KEY_PREFIX + cid);
    if (!raw) return [];
    return JSON.parse(raw) as HealthHistoryEntry[];
  } catch {
    return [];
  }
}
