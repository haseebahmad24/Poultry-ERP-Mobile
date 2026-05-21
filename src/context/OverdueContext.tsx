import React, { createContext, useContext, useState } from 'react';

interface OverdueContextType {
  apOverdue: number;
  arOverdue: number;
  lowStock: number;
  totalOverdue: number;
  totalAlerts: number;
  setAPOverdue: (n: number) => void;
  setAROverdue: (n: number) => void;
  setLowStock: (n: number) => void;
}

const OverdueContext = createContext<OverdueContextType>({
  apOverdue: 0,
  arOverdue: 0,
  lowStock: 0,
  totalOverdue: 0,
  totalAlerts: 0,
  setAPOverdue: () => {},
  setAROverdue: () => {},
  setLowStock: () => {},
});

export function OverdueProvider({ children }: { children: React.ReactNode }) {
  const [apOverdue, setAPOverdue] = useState(0);
  const [arOverdue, setAROverdue] = useState(0);
  const [lowStock, setLowStock] = useState(0);

  return (
    <OverdueContext.Provider
      value={{
        apOverdue,
        arOverdue,
        lowStock,
        totalOverdue: apOverdue + arOverdue,
        totalAlerts: apOverdue + arOverdue + lowStock,
        setAPOverdue,
        setAROverdue,
        setLowStock,
      }}
    >
      {children}
    </OverdueContext.Provider>
  );
}

export function useOverdue() {
  return useContext(OverdueContext);
}
