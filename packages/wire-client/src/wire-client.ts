import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { env } from './env';
import type { ApiErrorCode } from './error-messages';
import { SecureStorage } from './secure-storage';

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
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${env.EXPO_PUBLIC_API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
      REQUEST_TIMEOUT_MS,
      'Request timed out',
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('network request failed', 0, 'NETWORK_UNAVAILABLE' satisfies ApiErrorCode);
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
