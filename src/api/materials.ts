import { apiRequest } from './client';

export interface Material {
  id: number;
  name: string;
  code?: string;
  type?: string;
  type_id?: number;
  status?: string;
  unit?: string;
  category?: string;
  description?: string;
}

export interface MaterialType {
  id: number;
  name: string;
}

export async function fetchMaterials(opts: {
  companyId?: string | number;
  typeId?: number;
  status?: string;
} = {}): Promise<Material[]> {
  const params = new URLSearchParams({ view: 'list' });
  if (opts.companyId != null) params.set('company_id', String(opts.companyId));
  if (opts.typeId != null) params.set('type_id', String(opts.typeId));
  if (opts.status) params.set('status', opts.status);
  const data = await apiRequest<any>(`/api/mobile/materials?${params}`);
  return data.materials ?? data.items ?? (Array.isArray(data) ? data : []);
}

export async function fetchMaterialTypes(): Promise<MaterialType[]> {
  const data = await apiRequest<any>('/api/mobile/materials?view=types');
  return data.types ?? (Array.isArray(data) ? data : []);
}
