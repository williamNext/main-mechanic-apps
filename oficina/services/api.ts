import { Platform } from 'react-native';
import { SecureStorage } from '@/utils/secure-storage';
import { env } from '@/config/env';

export const AUTH_TOKEN_KEY = 'auth_token';

const REQUEST_TIMEOUT_MS = 15000;

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return SecureStorage.getItem(AUTH_TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch {
      // ignore storage failures on web (e.g. private browsing quota)
    }
    return;
  }
  await SecureStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // ignore storage failures on web
    }
    return;
  }
  await SecureStorage.removeItem(AUTH_TOKEN_KEY);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

// Typed fetch wrapper that replaces the Supabase client (Phase 1.5 ticket 05).
// Reads the stored token itself when `options.token` is not supplied, so call
// sites stay simple. Every request shares one timeout, and a non-2xx response
// throws an Error whose message is the server's `error` string verbatim —
// screens elsewhere match on substrings of these exact English strings, so
// this wrapper must never wrap, prefix or translate them.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const token = options.token !== undefined ? options.token : await getStoredToken();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await withTimeout(
      fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
      REQUEST_TIMEOUT_MS,
      'Request timed out',
    );
  } catch (err) {
    // A timed-out request already carries its own message; anything else
    // here is fetch itself rejecting (connection refused, DNS failure, no
    // network) — surfaced as its own status so screens can tell "server
    // unreachable" apart from a normal HTTP failure.
    if (err instanceof Error && err.message === 'Request timed out') {
      throw err;
    }
    throw new ApiError('network request failed', 0);
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      await clearStoredToken();
    }

    let message = res.statusText || 'Request failed';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        message = data.error;
      }
    } catch {
      // body wasn't JSON (or was empty) — fall back to statusText above
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
