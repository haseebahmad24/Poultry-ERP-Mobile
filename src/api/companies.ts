import { apiRequest } from './client';

export interface CompanyDetail {
  id: number;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  fiscal_year_start?: string;
  fiscal_year_end?: string;
  is_active?: boolean;
}

export async function fetchCompanies(): Promise<CompanyDetail[]> {
  const data = await apiRequest<any>('/api/mobile/companies');
  return data.companies ?? (Array.isArray(data) ? data : []);
}
