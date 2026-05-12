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

// The dashboard KPIs and recent vouchers are computed server-side on the web.
// For mobile we call dedicated endpoints (to be added to the web API) or
// fall back to computing via existing public endpoints.
// For now we expose the shapes and use the journal-entries + vouchers APIs.

export async function fetchDashboardData(companyId?: string): Promise<{
  kpis: KPIs;
  recentVouchers: RecentVoucher[];
}> {
  const qs = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
  const data = await apiRequest<{ kpis: KPIs; recentVouchers: RecentVoucher[] }>(
    `/api/dashboard${qs}`
  );
  return data;
}
