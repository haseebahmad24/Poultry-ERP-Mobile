import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  useCookie?: boolean;
  retries?: number;
}

const RETRY_DELAYS = [500, 1000, 2000];

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, useCookie = true, retries = 2 } = options;
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    if (useCookie) {
      headers['Cookie'] = `auth_token=${token}`;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1] ?? 2000);
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr: any) {
      lastError = new Error(`Network error: ${networkErr?.message ?? networkErr}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      const err = new Error(`API ${method} ${path} failed ${res.status}: ${text}`);
      if (isRetryable(res.status) && attempt < retries) {
        lastError = err;
        continue;
      }
      throw err;
    }

    return res.json() as Promise<T>;
  }

  throw lastError ?? new Error(`API ${method} ${path} failed after ${retries + 1} attempts`);
}
