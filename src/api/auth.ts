import { apiRequest, setToken, clearToken } from './client';

export type Employee = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

export async function fetchEmployees(): Promise<Employee[]> {
  const data = await apiRequest<{ employees: Employee[] }>('/api/employees');
  return data.employees ?? [];
}

export async function loginAs(employeeId: string): Promise<AuthUser> {
  const res = await fetch(
    `${getBaseUrl()}/api/auth/switch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employeeId }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Login failed: ${text || res.statusText}`);
  }

  const data = await res.json();

  // Token is returned in the response body for mobile clients
  if (data.token) {
    await setToken(data.token);
  }

  return data.user as AuthUser;
}

export async function logout(): Promise<void> {
  await clearToken();
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}
