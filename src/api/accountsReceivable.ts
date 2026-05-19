import { apiRequest } from './client';

export interface ARSummary {
  total_outstanding?: number;
  total_overdue?: number;
  customers_count?: number;
  invoices_count?: number;
  aging?: ARAging;
}

export interface ARAging {
  current?: number;
  days_30?: number;
  days_60?: number;
  days_90?: number;
  over_90?: number;
}

export interface ARInvoice {
  id: number;
  invoice_number?: string;
  customer?: string;
  customer_id?: number;
  dt?: string;
  due_date?: string;
  amount?: number;
  paid?: number;
  outstanding?: number;
  status?: string;
}

export interface ARCustomer {
  id: number;
  name?: string;
  outstanding?: number;
  overdue?: number;
  invoices_count?: number;
}

export async function fetchARSummary(companyId?: string | number): Promise<ARSummary> {
  const params = new URLSearchParams({ view: 'summary' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-receivable?${params}`);
  return data.summary ?? data ?? {};
}

export async function fetchARInvoices(companyId?: string | number): Promise<ARInvoice[]> {
  const params = new URLSearchParams({ view: 'invoices' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-receivable?${params}`);
  return data.invoices ?? (Array.isArray(data) ? data : []);
}

export async function fetchARCustomers(companyId?: string | number): Promise<ARCustomer[]> {
  const params = new URLSearchParams({ view: 'customers' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/accounts-receivable?${params}`);
  return data.customers ?? (Array.isArray(data) ? data : []);
}
