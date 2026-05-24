import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const SELECTED_COMPANY_KEY = 'setting:selectedCompanyId';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { authState } = useAuth();
  const isAuthenticated = authState.status === 'authenticated';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  const setSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      AsyncStorage.setItem(SELECTED_COMPANY_KEY, company.id).catch(() => {});
    } else {
      AsyncStorage.removeItem(SELECTED_COMPANY_KEY).catch(() => {});
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, savedId] = await Promise.all([
        fetchCompanies(),
        AsyncStorage.getItem(SELECTED_COMPANY_KEY),
      ]);
      setCompanies(data);
      setSelectedCompanyState((prev) => {
        if (prev) return prev; // already set (shouldn't happen on cold start, but guard)
        if (savedId) {
          const saved = data.find((c) => c.id === savedId);
          if (saved) return saved;
        }
        return data.length > 0 ? data[0] : null;
      });
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
      setSelectedCompanyState(null);
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
