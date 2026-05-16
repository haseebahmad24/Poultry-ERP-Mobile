import { apiRequest } from './client';

export interface PurchaseOrder {
  id: number;
  po_number?: string;
  vendor_name?: string;
  vendor_id?: number;
  status: string;
  dt: string;
  total_amount?: number;
  items_count?: number;
  received_qty?: number;
  ordered_qty?: number;
  company_id?: number;
  company_name?: string;
}

export interface POLine {
  id: number;
  item_name: string;
  item_code?: string;
  ordered_qty: number;
  received_qty: number;
  unit_price?: number;
  total?: number;
  uom?: string;
}

export interface PODetail extends PurchaseOrder {
  lines?: POLine[];
  received_pct?: number;
  notes?: string;
}

export async function fetchPurchaseOrders(params: {
  view?: 'all' | 'open' | 'progress';
  status?: string;
  companyId?: number;
} = {}): Promise<PurchaseOrder[]> {
  const p = new URLSearchParams({ view: params.view ?? 'all' });
  if (params.status) p.set('status', params.status);
  if (params.companyId) p.set('company_id', String(params.companyId));
  const data = await apiRequest<any>(`/api/mobile/purchase-orders?${p}`);
  return data.purchase_orders ?? data.orders ?? [];
}

export async function fetchPODetail(id: number): Promise<PODetail | null> {
  const data = await apiRequest<any>(
    `/api/mobile/purchase-orders?view=progress&id=${id}`
  );
  // API may return { order: {...} } or { progress: [{...}] } or { purchase_orders: [{...}] }
  return data.order ?? data.progress?.[0] ?? data.purchase_orders?.[0] ?? null;
}
