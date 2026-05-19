import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCompanies } from '@/api/dashboard';
import { useAuth } from '@/context/AuthContext';

type Company = { id: string; name: string; code: string | null };

interface CompanyContextValue {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companyId: string | undefined;
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
  const { authState } = useAuth();
  const isAuthenticated = authState.status === 'authenticated';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCompanies();
      setCompanies(data);
      setSelectedCompany((prev) => prev ?? (data.length > 0 ? data[0] : null));
    } catch {
      // Non-fatal — screens fall back to no company filter
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      load();
    } else {
      setCompanies([]);
      setSelectedCompany(null);
    }
  }, [isAuthenticated, load]);

  const companyId = selectedCompany?.id;

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
