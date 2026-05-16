import { apiRequest } from './client';

export interface StockBalance {
  item_id: number;
  item_name: string;
  item_code?: string;
  category?: string;
  uom?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  quantity: number;
  unit_cost?: number;
  total_value?: number;
}

export interface StockLedgerEntry {
  id: number;
  dt: string;
  voucher_type?: string;
  voucher_number?: string;
  item_id?: number;
  item_name?: string;
  warehouse_name?: string;
  qty_in?: number;
  qty_out?: number;
  balance?: number;
  notes?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  code?: string;
  category?: string;
  uom?: string;
  is_active?: boolean;
}

export async function fetchStockBalances(companyId?: number): Promise<StockBalance[]> {
  const p = new URLSearchParams({ view: 'stock' });
  if (companyId) p.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/inventory?${p}`);
  return data.stock ?? data.balances ?? [];
}

export async function fetchStockLedger(params: {
  companyId?: number;
  itemId?: number;
  warehouseId?: number;
  from?: string;
  to?: string;
} = {}): Promise<StockLedgerEntry[]> {
  const p = new URLSearchParams({ view: 'ledger' });
  if (params.companyId) p.set('company_id', String(params.companyId));
  if (params.itemId) p.set('item_id', String(params.itemId));
  if (params.warehouseId) p.set('warehouse_id', String(params.warehouseId));
  if (params.from) p.set('from', params.from);
  if (params.to) p.set('to', params.to);
  const data = await apiRequest<any>(`/api/mobile/inventory?${p}`);
  return data.ledger ?? data.entries ?? [];
}

export async function fetchInventoryItems(companyId?: number): Promise<InventoryItem[]> {
  const p = new URLSearchParams({ view: 'items' });
  if (companyId) p.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/inventory?${p}`);
  return data.items ?? [];
}
