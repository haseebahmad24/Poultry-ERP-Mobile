import { apiRequest } from './client';

export type KPIs = {
  revenue: number;
  expenses: number;
  cash: number;
  vouchersMonth: number;
  vouchersToday: number;
  totalAR: number;
  totalAP: number;
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

export async function fetchDashboardData(companyId?: string): Promise<{
  kpis: KPIs;
  recentVouchers: RecentVoucher[];
}> {
  const cq = companyId ? `&company_id=${encodeURIComponent(companyId)}` : '';
  const cqOnly = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  const from = startOfMonthISO();
  const to = todayISO();

  const [tbRes, arRes, apRes, jeRes] = await Promise.all([
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
  ]);

  const tbRows = tbRes.rows ?? [];
  const cash = tbRows
    .filter((r) => String(r.code ?? '').startsWith('10'))
    .reduce((s, r) => s + (Number(r.balance_debit) || 0) - (Number(r.balance_credit) || 0), 0);

  const entries = jeRes.entries ?? [];

  let revenueMTD = 0;
  let expensesMTD = 0;
  for (const e of entries) {
    for (const ln of e.lines ?? []) {
      const code = String(ln.account_code ?? '');
      const debit = Number(ln.debit) || 0;
      const credit = Number(ln.credit) || 0;
      if (code.startsWith('4')) revenueMTD += credit - debit;
      else if (code.startsWith('5')) expensesMTD += debit - credit;
    }
  }

  const vouchersMonth = entries.length;
  const vouchersToday = entries.filter((e) => e.date === to).length;

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

  return {
    kpis: {
      revenue: revenueMTD,
      expenses: expensesMTD,
      cash,
      vouchersMonth,
      vouchersToday,
      totalAR: Number(arRes.totals?.total_ar) || 0,
      totalAP: Number(apRes.totals?.total_ap) || 0,
    },
    recentVouchers,
  };
}
