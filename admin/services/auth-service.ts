import { clearStoredToken, getStoredToken, isApiError, request, setStoredToken } from '@main-mechanic/wire-client';
import { AdminUser, AuthResponse, ProfileUserResponse } from '@main-mechanic/types';

async function requireAdmin(user: ProfileUserResponse): Promise<AdminUser> {
  if (user.role !== 'admin') {
    await clearStoredToken();
    throw new Error('Acesso administrativo obrigatório');
  }
  return user as AdminUser;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Email e senha são obrigatórios');
  }

  const { token, user } = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email: normalizedEmail, password },
    token: null,
  });
  const admin = await requireAdmin(user);
  await setStoredToken(token);
  return admin;
}

export async function logout(): Promise<void> {
  try {
    const token = await getStoredToken();
    if (token) {
      await request<void>('/auth/logout', { method: 'POST', token });
    }
  } catch {
  } finally {
    await clearStoredToken();
  }
}

export async function getCurrentSessionUser(): Promise<AdminUser | null> {
  const token = await getStoredToken();
  if (!token) return null;

  try {
    const user = await request<ProfileUserResponse>('/auth/me', { token });
    return await requireAdmin(user);
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}
