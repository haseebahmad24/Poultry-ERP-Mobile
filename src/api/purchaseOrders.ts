import { apiRequest } from './client';

export interface POItem {
  id?: number;
  item_id?: number;
  item_name: string;
  qty_ordered: number;
  qty_received?: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface PurchaseOrder {
  id: number;
  po_number?: string;
  vendor?: string;
  vendor_id?: number;
  dt?: string;
  delivery_date?: string;
  status?: string;
  total?: number;
  currency?: string;
  notes?: string;
  items?: POItem[];
}

export async function fetchPurchaseOrders(
  view: 'all' | 'open' | 'progress' = 'all',
  status?: string
): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams({ view });
  if (status) params.set('status', status);
  const data = await apiRequest<any>(`/api/mobile/purchase-orders?${params}`);
  return data.orders ?? data.purchaseOrders ?? (Array.isArray(data) ? data : []);
}

export async function fetchPODetail(id: number): Promise<PurchaseOrder> {
  const data = await apiRequest<any>(`/api/mobile/purchase-orders?id=${id}`);
  return data.order ?? data.purchaseOrder ?? (typeof data === 'object' ? data : {}) as PurchaseOrder;
}
