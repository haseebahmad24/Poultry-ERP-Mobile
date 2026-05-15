import { apiRequest } from './client';

export interface SOItem {
  id?: number;
  item_id?: number;
  item_name: string;
  qty: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface SalesOrder {
  id: number;
  so_number?: string;
  customer?: string;
  customer_id?: number;
  dt?: string;
  delivery_date?: string;
  status?: string;
  total?: number;
  currency?: string;
  notes?: string;
  items?: SOItem[];
}

type SOView = 'open' | 'approved' | 'closed' | 'register';

export async function fetchSalesOrders(
  view: SOView = 'register',
  opts: { companyId?: number; from?: string; to?: string } = {}
): Promise<SalesOrder[]> {
  const params = new URLSearchParams({ view });
  if (opts.companyId != null) params.set('company_id', String(opts.companyId));
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const data = await apiRequest<any>(`/api/mobile/sales-orders?${params}`);
  return data.orders ?? data.salesOrders ?? (Array.isArray(data) ? data : []);
}

export async function fetchSODetail(id: number): Promise<SalesOrder> {
  const data = await apiRequest<any>(`/api/mobile/sales-orders?view=detail&id=${id}`);
  return data.order ?? data.salesOrder ?? (typeof data === 'object' ? data : {}) as SalesOrder;
}
