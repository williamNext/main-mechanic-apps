import { supabase } from './api';
import { User, Mechanic } from '@/types/models';

const AUTH_TIMEOUT_MS = 15000;
const PROFILE_TIMEOUT_MS = 15000;
const SIGNUP_TIMEOUT_MS = 20000;

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function timed<T>(label: string, task: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await task();
    if (isDev) console.log(`[auth] ${label} ok in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    if (isDev) console.log(`[auth] ${label} failed in ${Date.now() - start}ms`, error);
    throw error;
  }
}

export async function login(email: string, password: string): Promise<User | Mechanic | null> {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const { data: authData, error: authError } = await timed('email signInWithPassword', () =>
    withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      AUTH_TIMEOUT_MS,
      'Email login request timed out',
    ),
  );

  if (authError || !authData.user) throw authError;

  return getUserById(authData.user.id);
}

export function toE164BrPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return `+${digits}`;
  return null;
}

export async function loginByPhone(phone: string, password: string): Promise<User | Mechanic | null> {
  if (!phone || !password) {
    throw new Error('Phone and password are required');
  }

  const normalizedPhone = toE164BrPhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number');
  }

  const { data: authData, error: authError } = await timed('phone signInWithPassword', () =>
    withTimeout(
      supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password,
      }),
      AUTH_TIMEOUT_MS,
      'Phone login request timed out',
    ),
  );

  if (authError || !authData.user) throw authError;

  return getUserById(authData.user.id);
}

export async function logout() {
  const { error } = await withTimeout(
    supabase.auth.signOut(),
    AUTH_TIMEOUT_MS,
    'Logout request timed out',
  );

  if (error) throw error;
}

export async function getUserById(id: string): Promise<User | Mechanic | null> {
  const { data, error } = await timed('profile select', () =>
    withTimeout(
      supabase
        .from('profiles')
        .select('*, mechanics(*)')
        .eq('id', id)
        .single(),
      PROFILE_TIMEOUT_MS,
      'Profile request timed out',
    ),
  );

  if (error || !data) return null;

  if (data.role === 'mechanic' && data.mechanics) {
    const mechData = Array.isArray(data.mechanics) ? data.mechanics[0] : data.mechanics;
    return { ...data, ...mechData } as Mechanic;
  }
  return data as User;
}

export async function signUpWithPhone(phone: string, password: string, name: string, role: 'client'): Promise<void> {
  const normalizedPhone = toE164BrPhone(phone);
  if (!normalizedPhone) {
    throw new Error('Invalid phone number');
  }

  const { data: authData, error: authError } = await timed('signUp', () =>
    withTimeout(
      supabase.auth.signUp({
        phone: normalizedPhone,
        password,
        options: {
          data: { name, role, phone: normalizedPhone },
          channel: 'sms',
        }
      }),
      SIGNUP_TIMEOUT_MS,
      'Register request timed out',
    ),
  );

  if (authError || !authData.user) throw authError;
  const userId = authData.user.id;

  const { error: profileError } = await timed('profile insert', () =>
    withTimeout(
      supabase.from('profiles').insert({
        id: userId,
        name,
        email: null,
        role,
        phone: normalizedPhone,
      }),
      PROFILE_TIMEOUT_MS,
      'Profile insert request timed out',
    ),
  );

  if (profileError) throw profileError;

}

export async function signUp(email: string, password: string, name: string, role: 'client', phone?: string): Promise<void> {
  const { data: authData, error: authError } = await timed('signUp email', () =>
    withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, phone }
        }
      }),
      SIGNUP_TIMEOUT_MS,
      'Register request timed out',
    ),
  );

  if (authError || !authData.user) throw authError;
  const userId = authData.user.id;

  const { error: profileError } = await timed('profile insert', () =>
    withTimeout(
      supabase.from('profiles').insert({
        id: userId,
        name,
        email,
        role,
        phone,
      }),
      PROFILE_TIMEOUT_MS,
      'Profile insert request timed out',
    ),
  );

  if (profileError) throw profileError;
}

export async function getCurrentSessionUser(): Promise<User | Mechanic | null> {
  const { data: { session } } = await timed('getSession', () =>
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'Session request timed out'),
  );
  if (!session?.user) return null;
  return getUserById(session.user.id);
}
