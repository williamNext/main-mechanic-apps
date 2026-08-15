import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { SecureStorage } from '@/utils/secure-storage';

export const AUTH_TOKEN_KEY = 'auth_token';

export const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const token = options.token !== undefined ? options.token : await getStoredToken();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network request failed', 0, 'NETWORK_UNAVAILABLE');
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      await clearStoredToken();
    }

    let message = response.statusText || 'Request failed';
    let code: string | undefined;
    try {
      const data: unknown = await response.json();
      if (data && typeof data === 'object') {
        if ('error' in data && typeof data.error === 'string') message = data.error;
        if ('code' in data && typeof data.code === 'string') code = data.code;
      }
    } catch {
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
