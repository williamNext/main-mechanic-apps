import { supabase } from './api';
import { User, Mechanic } from '@/types/models';

const AUTH_TIMEOUT_MS = 15000;
const PROFILE_TIMEOUT_MS = 15000;

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
    if (isDev) console.log(`[auth] ${label} falhou em ${Date.now() - start}ms`, error);
    throw error;
  }
}

export async function login(email: string, password: string): Promise<User | Mechanic | null> {
  if (!email || !password) {
    throw new Error('E-mail e senha sao obrigatorios');
  }

  const { data: authData, error: authError } = await timed('email signInWithPassword', () =>
    withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
      AUTH_TIMEOUT_MS,
      'Tempo limite excedido ao entrar por e-mail',
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
    throw new Error('Telefone e senha sao obrigatorios');
  }

  const normalizedPhone = toE164BrPhone(phone);
  if (!normalizedPhone) {
    throw new Error('Telefone invalido');
  }

  const { data: authData, error: authError } = await timed('phone signInWithPassword', () =>
    withTimeout(
      supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password,
      }),
      AUTH_TIMEOUT_MS,
      'Tempo limite excedido ao entrar por telefone',
    ),
  );

  if (authError || !authData.user) throw authError;

  return getUserById(authData.user.id);
}

export async function logout() {
  const { error } = await withTimeout(
    supabase.auth.signOut(),
    AUTH_TIMEOUT_MS,
    'Tempo limite excedido ao sair',
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
      'Tempo limite excedido ao carregar perfil',
    ),
  );

  if (error || !data) return null;

  if (data.role === 'mechanic' && data.mechanics) {
    const mechData = Array.isArray(data.mechanics) ? data.mechanics[0] : data.mechanics;
    return {
      ...data,
      ...mechData,
      avatarUrl: data.avatar_url ?? undefined,
      isActive: mechData.is_active,
    } as Mechanic;
  }
  return { ...data, avatarUrl: data.avatar_url ?? undefined } as User;
}

export async function getCurrentSessionUser(): Promise<User | Mechanic | null> {
  const { data: { session } } = await timed('getSession', () =>
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'Tempo limite excedido ao carregar sessao'),
  );
  if (!session?.user) return null;
  return getUserById(session.user.id);
}
