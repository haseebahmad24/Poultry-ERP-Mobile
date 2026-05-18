import { apiRequest } from './client';

export interface Partner {
  id: number;
  name: string;
  code?: string;
  type?: string;
  roles?: string[];
  is_customer?: boolean;
  is_vendor?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: number;
  company?: string;
}

export async function fetchPartners(companyId?: number): Promise<Partner[]> {
  const params = new URLSearchParams();
  if (companyId != null) params.set('company_id', String(companyId));
  const data = await apiRequest<any>(`/api/mobile/partners?${params}`);
  return data.partners ?? (Array.isArray(data) ? data : []);
}
