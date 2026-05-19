import { apiRequest } from './client';

export interface APSummary {
  total_outstanding?: number;
  total_overdue?: number;
  vendors_count?: number;
  bills_count?: number;
  aging?: APAging;
}

export interface APAging {
  current?: number;
  days_30?: number;
  days_60?: number;
  days_90?: number;
  over_90?: number;
}

export interface APBill {
  id: number;
  bill_number?: string;
  vendor?: string;
  vendor_id?: number;
  dt?: string;
  due_date?: string;
  amount?: number;
  paid?: number;
  outstanding?: number;
  status?: string;
}

export interface APVendor {
  id: number;
  name?: string;
  outstanding?: number;
  overdue?: number;
  bills_count?: number;
}

export async function fetchAPSummary(companyId?: string | number): Promise<APSummary> {
  const params = new URLSearchParams({ view: 'summary' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-payable?${params}`);
  return data.summary ?? data ?? {};
}

export async function fetchAPBills(companyId?: string | number): Promise<APBill[]> {
  const params = new URLSearchParams({ view: 'bills' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-payable?${params}`);
  return data.bills ?? (Array.isArray(data) ? data : []);
}

export async function fetchAPVendors(companyId?: string | number): Promise<APVendor[]> {
  const params = new URLSearchParams({ view: 'vendors' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-payable?${params}`);
  return data.vendors ?? (Array.isArray(data) ? data : []);
}
