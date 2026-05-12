import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getToken, clearToken } from '@/api/client';
import { AuthUser, loginAs as apiLoginAs, logout as apiLogout } from '@/api/auth';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: AuthUser };

type AuthContextValue = {
  authState: AuthState;
  loginAs: (employeeId: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    getToken().then((token) => {
      if (token) {
        // Token exists; we treat the user as authenticated.
        // A full app would re-verify the token or call /api/auth/me.
        // For now restore minimal state from token payload.
        try {
          const payload = decodeJwtPayload(token);
          setAuthState({
            status: 'authenticated',
            user: {
              id: payload.id,
              name: payload.name,
              email: payload.email ?? null,
              role: payload.role ?? null,
            },
          });
        } catch {
          setAuthState({ status: 'unauthenticated' });
        }
      } else {
        setAuthState({ status: 'unauthenticated' });
      }
    });
  }, []);

  const loginAs = useCallback(async (employeeId: string): Promise<AuthUser> => {
    const user = await apiLoginAs(employeeId);
    setAuthState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAuthState({ status: 'unauthenticated' });
  }, []);

  return (
    <AuthContext.Provider value={{ authState, loginAs, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function decodeJwtPayload(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(base64);
  return JSON.parse(json);
}
