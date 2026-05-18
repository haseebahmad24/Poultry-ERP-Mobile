import { apiRequest } from './client';

export interface TrialBalanceRow {
  account_id?: number;
  account_code?: string;
  account_name: string;
  account_type?: string;
  debit: number;
  credit: number;
  balance: number;
  level?: number;
  is_group?: boolean;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  total_debit?: number;
  total_credit?: number;
  as_of?: string;
  company?: string;
}

export async function fetchTrialBalance(
  companyId?: number,
  asOf?: string
): Promise<TrialBalanceResult> {
  const params = new URLSearchParams();
  if (companyId != null) params.set('company_id', String(companyId));
  if (asOf) params.set('as_of', asOf);
  const data = await apiRequest<any>(`/api/mobile/trial-balance?${params}`);
  if (Array.isArray(data)) {
    return { rows: data };
  }
  return {
    rows: data.rows ?? data.accounts ?? [],
    total_debit: data.total_debit,
    total_credit: data.total_credit,
    as_of: data.as_of,
    company: data.company,
  };
}
