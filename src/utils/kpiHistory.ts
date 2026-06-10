import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KpiHistoryEntry {
  date: string; // YYYY-MM-DD
  companyId: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  vouchersMonth: number;
}

const HISTORY_KEY_PREFIX = 'kpi-history:';
const MAX_ENTRIES = 7;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveKpiSnapshot(
  companyId: string | number | undefined,
  kpis: { revenue: number; expenses: number; vouchersMonth: number },
): Promise<void> {
  const cid = String(companyId ?? 'all');
  const history = await loadKpiHistory(companyId);
  const today = todayISO();
  // Skip if we already have an entry for today
  if (history.length > 0 && history[history.length - 1].date === today) {
    // Update today's entry with latest values
    history[history.length - 1] = {
      date: today,
      companyId: cid,
      revenue: kpis.revenue,
      expenses: kpis.expenses,
      netIncome: kpis.revenue - kpis.expenses,
      vouchersMonth: kpis.vouchersMonth,
    };
  } else {
    history.push({
      date: today,
      companyId: cid,
      revenue: kpis.revenue,
      expenses: kpis.expenses,
      netIncome: kpis.revenue - kpis.expenses,
      vouchersMonth: kpis.vouchersMonth,
    });
    if (history.length > MAX_ENTRIES) {
      history.splice(0, history.length - MAX_ENTRIES);
    }
  }
  await AsyncStorage.setItem(HISTORY_KEY_PREFIX + cid, JSON.stringify(history));
}

export async function loadKpiHistory(
  companyId: string | number | undefined,
): Promise<KpiHistoryEntry[]> {
  const cid = String(companyId ?? 'all');
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY_PREFIX + cid);
    if (!raw) return [];
    return JSON.parse(raw) as KpiHistoryEntry[];
  } catch {
    return [];
  }
}
