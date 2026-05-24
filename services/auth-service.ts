import { supabase } from '@/services/api';
import { AdminUser, User } from '@/types/models';

const AUTH_TIMEOUT_MS = 15000;
const PROFILE_TIMEOUT_MS = 15000;

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

export function toE164BrPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
  return null;
}

export async function login(identifier: string, password: string): Promise<AdminUser | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!normalizedIdentifier || !password) {
    throw new Error('Email ou telefone e senha são obrigatórios');
  }

  const credentials = normalizedIdentifier.includes('@')
    ? { email: normalizedIdentifier, password }
    : { phone: toE164BrPhone(normalizedIdentifier) ?? '', password };

  if ('phone' in credentials && !credentials.phone) {
    throw new Error('Telefone inválido');
  }

  const { data: authData, error: authError } = await withTimeout(
    supabase.auth.signInWithPassword(credentials),
    AUTH_TIMEOUT_MS,
    'Login expirou',
  );

  if (authError || !authData.user) throw authError;

  return getAdminById(authData.user.id);
}

export async function logout() {
  const { error } = await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS, 'Saída expirou');

  if (error) throw error;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await withTimeout(
    supabase.from('profiles').select('id, name, email, role, phone, avatar_url, created_at').eq('id', id).single(),
    PROFILE_TIMEOUT_MS,
    'Carregamento do perfil expirou',
  );

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
  };
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  const user = await getUserById(id);

  if (!user || user.role !== 'admin') {
    await supabase.auth.signOut();
    throw new Error('Acesso administrativo obrigatório');
  }

  return user as AdminUser;
}

export async function getCurrentSessionUser(): Promise<AdminUser | null> {
  const {
    data: { session },
  } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'Carregamento da sessão expirou');

  if (!session?.user) return null;

  return getAdminById(session.user.id);
}
