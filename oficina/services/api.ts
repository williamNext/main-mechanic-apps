import { Platform } from 'react-native';
import { SecureStorage } from '@/utils/secure-storage';
import { env } from '@/config/env';
import type { ApiErrorCode } from './error-messages';

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

export class ApiError extends Error {
  status: number;
  code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new ApiError(message, 0, 'REQUEST_TIMEOUT' satisfies ApiErrorCode)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

// Server English messages must reach clients verbatim.
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
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError('network request failed', 0, 'NETWORK_UNAVAILABLE' satisfies ApiErrorCode);
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      await clearStoredToken();
    }

    let message = res.statusText || 'Request failed';
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        message = data.error;
      }
      if (data && typeof data.code === 'string') {
        code = data.code;
      }
    } catch {
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
