import { apiRequest } from './client';

export type KPIs = {
  revenue: number;
  expenses: number;
  cash: number;
  vouchersMonth: number;
  vouchersToday: number;
  totalAR: number;
  totalAP: number;
  revenuePrevMonth: number | null;
  expensesPrevMonth: number | null;
  vouchersPrevMonth: number | null;
  /** Daily voucher counts for the last 7 days, oldest first. */
  dailyVouchers: { date: string; count: number }[];
};

export type RecentVoucher = {
  id: string;
  number: string | null;
  type: string;
  dt: string;
  status: string | null;
  created_by: string | null;
  amount: number;
};

export type Company = {
  id: string;
  name: string;
  code: string | null;
};

export async function fetchCompanies(): Promise<Company[]> {
  const data = await apiRequest<{ companies: Company[] }>('/api/options/companies');
  return data.companies ?? [];
}

type TBRow = {
  code: string;
  name: string;
  balance_debit: number;
  balance_credit: number;
};

type JournalLine = {
  account_code: string;
  debit: number;
  credit: number;
};

type JournalEntry = {
  id: number;
  number: string | null;
  date: string;
  type: string;
  status: string | null;
  lines: JournalLine[];
  total_debit: number;
  total_credit: number;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function prevMonthRangeISO(): { from: string; to: string } {
  const d = new Date();
  const firstOfCurrent = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastOfPrev = new Date(firstOfCurrent.getTime() - 86400000); // day before current month
  const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
  return {
    from: firstOfPrev.toISOString().slice(0, 10),
    to: lastOfPrev.toISOString().slice(0, 10),
  };
}

function sumRevenueExpenses(entries: JournalEntry[]): { revenue: number; expenses: number } {
  let revenue = 0;
  let expenses = 0;
  for (const e of entries) {
    for (const ln of e.lines ?? []) {
      const code = String(ln.account_code ?? '');
      const debit = Number(ln.debit) || 0;
      const credit = Number(ln.credit) || 0;
      if (code.startsWith('4')) revenue += credit - debit;
      else if (code.startsWith('5')) expenses += debit - credit;
    }
  }
  return { revenue, expenses };
}

export type VoucherTypeStat = { type: string; count: number; amount: number };

export async function fetchDashboardData(companyId?: string): Promise<{
  kpis: KPIs;
  recentVouchers: RecentVoucher[];
  voucherTypeStats: VoucherTypeStat[];
}> {
  const cq = companyId ? `&company_id=${encodeURIComponent(companyId)}` : '';
  const cqOnly = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  const from = startOfMonthISO();
  const to = todayISO();
  const prev = prevMonthRangeISO();

  const [tbRes, arRes, apRes, jeRes, jePrevRes] = await Promise.all([
    apiRequest<{ rows: TBRow[] }>(`/api/mobile/trial-balance${cqOnly}`).catch(() => ({ rows: [] })),
    apiRequest<{ totals: { total_ar: number } }>(
      `/api/mobile/accounts-receivable?view=summary${cq}`
    ).catch(() => ({ totals: { total_ar: 0 } })),
    apiRequest<{ totals: { total_ap: number } }>(
      `/api/mobile/accounts-payable?view=summary${cq}`
    ).catch(() => ({ totals: { total_ap: 0 } })),
    apiRequest<{ entries: JournalEntry[] }>(
      `/api/mobile/journal-entries?from=${from}&to=${to}${cq}`
    ).catch(() => ({ entries: [] })),
    apiRequest<{ entries: JournalEntry[] }>(
      `/api/mobile/journal-entries?from=${prev.from}&to=${prev.to}${cq}`
    ).catch(() => null),
  ]);

  const tbRows = tbRes.rows ?? [];
  const cash = tbRows
    .filter((r) => String(r.code ?? '').startsWith('10'))
    .reduce((s, r) => s + (Number(r.balance_debit) || 0) - (Number(r.balance_credit) || 0), 0);

  const entries = jeRes.entries ?? [];
  const { revenue: revenueMTD, expenses: expensesMTD } = sumRevenueExpenses(entries);

  let revenuePrevMonth: number | null = null;
  let expensesPrevMonth: number | null = null;
  let vouchersPrevMonth: number | null = null;
  if (jePrevRes !== null) {
    const prevEntries = jePrevRes.entries ?? [];
    const prevSums = sumRevenueExpenses(prevEntries);
    revenuePrevMonth = prevSums.revenue;
    expensesPrevMonth = prevSums.expenses;
    vouchersPrevMonth = prevEntries.length;
  }

  const vouchersMonth = entries.length;
  const vouchersToday = entries.filter((e) => e.date === to).length;

  // Build last-7-days daily voucher count (oldest → newest)
  const dailyVouchers: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyVouchers.push({ date: dateStr, count: 0 });
  }
  for (const e of entries) {
    const slot = dailyVouchers.find((s) => s.date === e.date);
    if (slot) slot.count += 1;
  }

  const recentVouchers: RecentVoucher[] = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
    .slice(0, 5)
    .map((e) => ({
      id: String(e.id),
      number: e.number,
      type: e.type,
      dt: e.date,
      status: e.status,
      created_by: null,
      amount: Number(e.total_debit) || 0,
    }));

  // Aggregate by type for the activity chart
  const typeMap: Record<string, { count: number; amount: number }> = {};
  for (const e of entries) {
    const t = e.type ?? 'OTHER';
    if (!typeMap[t]) typeMap[t] = { count: 0, amount: 0 };
    typeMap[t].count += 1;
    typeMap[t].amount += Number(e.total_debit) || 0;
  }
  const voucherTypeStats: VoucherTypeStat[] = Object.entries(typeMap)
    .map(([type, v]) => ({ type, count: v.count, amount: v.amount }))
    .sort((a, b) => b.count - a.count);

  return {
    kpis: {
      revenue: revenueMTD,
      expenses: expensesMTD,
      cash,
      vouchersMonth,
      vouchersToday,
      totalAR: Number(arRes.totals?.total_ar) || 0,
      totalAP: Number(apRes.totals?.total_ap) || 0,
      revenuePrevMonth,
      expensesPrevMonth,
      vouchersPrevMonth,
      dailyVouchers,
    },
    recentVouchers,
    voucherTypeStats,
  };
}
