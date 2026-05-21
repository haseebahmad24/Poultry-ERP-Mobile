import React, { createContext, useContext, useState } from 'react';

interface OverdueContextType {
  apOverdue: number;
  arOverdue: number;
  totalOverdue: number;
  setAPOverdue: (n: number) => void;
  setAROverdue: (n: number) => void;
}

const OverdueContext = createContext<OverdueContextType>({
  apOverdue: 0,
  arOverdue: 0,
  totalOverdue: 0,
  setAPOverdue: () => {},
  setAROverdue: () => {},
});

export function OverdueProvider({ children }: { children: React.ReactNode }) {
  const [apOverdue, setAPOverdue] = useState(0);
  const [arOverdue, setAROverdue] = useState(0);

  return (
    <OverdueContext.Provider
      value={{
        apOverdue,
        arOverdue,
        totalOverdue: apOverdue + arOverdue,
        setAPOverdue,
        setAROverdue,
      }}
    >
      {children}
    </OverdueContext.Provider>
  );
}

export function useOverdue() {
  return useContext(OverdueContext);
}
