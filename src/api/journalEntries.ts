import { apiRequest } from './client';

export interface JournalEntry {
  id: number;
  voucher_type?: string;
  voucher_no?: string;
  dt?: string;
  narration?: string;
  total_debit?: number;
  total_credit?: number;
  status?: string;
  lines?: JELine[];
}

export interface JELine {
  id?: number;
  account?: string;
  account_id?: number;
  debit?: number;
  credit?: number;
  narration?: string;
}

export async function fetchJournalEntries(opts: {
  companyId?: number;
  from?: string;
  to?: string;
  account?: string;
  type?: string;
} = {}): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  if (opts.companyId != null) params.set('company_id', String(opts.companyId));
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.account) params.set('account', opts.account);
  if (opts.type) params.set('type', opts.type);
  const data = await apiRequest<any>(`/api/mobile/journal-entries?${params}`);
  return data.entries ?? data.vouchers ?? (Array.isArray(data) ? data : []);
}
