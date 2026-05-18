import { apiRequest } from './client';

export interface StockBalance {
  item_id?: number;
  item_name: string;
  item_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  qty: number;
  unit?: string;
}

export interface StockLedgerEntry {
  id?: number;
  dt: string;
  voucher_type?: string;
  voucher_no?: string;
  item_id?: number;
  item_name?: string;
  warehouse_name?: string;
  qty_in?: number;
  qty_out?: number;
  balance?: number;
  unit?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  code?: string;
  category?: string;
  uom?: string;
}

export async function fetchStockBalances(companyId?: number): Promise<StockBalance[]> {
  const params = new URLSearchParams({ view: 'stock' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/inventory?${params}`);
  return data.stock ?? data.balances ?? (Array.isArray(data) ? data : []);
}

export async function fetchStockLedger(opts: {
  companyId?: number;
  itemId?: number;
  warehouseId?: number;
  from?: string;
  to?: string;
} = {}): Promise<StockLedgerEntry[]> {
  const params = new URLSearchParams({ view: 'ledger' });
  if (opts.companyId != null) params.set('company_id', String(opts.companyId));
  if (opts.itemId != null) params.set('item_id', String(opts.itemId));
  if (opts.warehouseId != null) params.set('warehouse_id', String(opts.warehouseId));
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  const data = await apiRequest<any>(`/api/mobile/inventory?${params}`);
  return data.ledger ?? data.entries ?? (Array.isArray(data) ? data : []);
}

export async function fetchInventoryItems(companyId?: number): Promise<InventoryItem[]> {
  const params = new URLSearchParams({ view: 'items' });
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/inventory?${params}`);
  return data.items ?? (Array.isArray(data) ? data : []);
}
