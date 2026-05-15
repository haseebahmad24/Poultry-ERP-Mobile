import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCompanies } from '@/api/dashboard';

type Company = { id: string; name: string; code: string | null };

interface CompanyContextValue {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companyId: number | undefined;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  companies: [],
  selectedCompany: null,
  setSelectedCompany: () => {},
  companyId: undefined,
  loading: false,
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
      // Auto-select first company if none selected
      if (data.length > 0) setSelectedCompany(data[0]);
    } catch {
      // Non-fatal — screens fall back to no company filter
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const companyId = selectedCompany ? Number(selectedCompany.id) : undefined;

  return (
    <CompanyContext.Provider
      value={{ companies, selectedCompany, setSelectedCompany, companyId, loading }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
