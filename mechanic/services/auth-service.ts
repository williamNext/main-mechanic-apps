import { request, getStoredToken, setStoredToken, clearStoredToken, isApiError } from '@main-mechanic/wire-client';
import { User, Mechanic } from '@/types/models';

interface AuthResponse {
  token: string;
  user: User | Mechanic;
}

export async function login(email: string, password: string): Promise<User | Mechanic> {
  const { token, user } = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
  });
  await setStoredToken(token);
  return user;
}

export async function logout(): Promise<void> {
  try {
    const token = await getStoredToken();
    if (token) {
      await request<void>('/auth/logout', { method: 'POST', token });
    }
  } catch {
    // A user must never end up trapped in a session they asked to end,
    // regardless of whether the server was reachable.
  } finally {
    await clearStoredToken();
  }
}

export async function getCurrentSessionUser(): Promise<User | Mechanic | null> {
  const token = await getStoredToken();
  if (!token) return null;

  try {
    return await request<User | Mechanic>('/auth/me', { token });
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return null;
    }
    throw error;
  }
}
