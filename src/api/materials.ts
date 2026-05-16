import { apiRequest } from './client';

export interface MaterialType {
  id: number;
  name: string;
  code?: string;
}

export interface Material {
  id: number;
  name: string;
  code?: string;
  type_id?: number;
  type_name?: string;
  status?: string;
  description?: string;
  unit?: string;
  company_id?: number;
}

export async function fetchMaterials(params: {
  companyId?: number;
  typeId?: number;
  status?: string;
} = {}): Promise<Material[]> {
  const p = new URLSearchParams({ view: 'list' });
  if (params.companyId) p.set('company_id', String(params.companyId));
  if (params.typeId) p.set('type_id', String(params.typeId));
  if (params.status) p.set('status', params.status);
  const data = await apiRequest<any>(`/api/mobile/materials?${p}`);
  return data.materials ?? data.items ?? [];
}

export async function fetchMaterialTypes(): Promise<MaterialType[]> {
  const data = await apiRequest<any>(`/api/mobile/materials?view=types`);
  return data.types ?? data.material_types ?? [];
}
