import { supabase } from './api';
import { User, Mechanic, Role } from '@/types/models';
import { toPseudoEmail } from '@/utils/format';

export async function login(email: string, password: string): Promise<User | Mechanic | null> {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) throw authError;

  return getUserById(authData.user.id);
}

function toE164BrPhone(phone: string): string | null {
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

  const phoneAttempt = await supabase.auth.signInWithPassword({
    phone: normalizedPhone,
    password,
  });

  if (!phoneAttempt.error && phoneAttempt.data.user) {
    return getUserById(phoneAttempt.data.user.id);
  }

  const legacyEmailAttempt = await supabase.auth.signInWithPassword({
    email: toPseudoEmail(phone),
    password,
  });

  if (legacyEmailAttempt.error || !legacyEmailAttempt.data.user) {
    throw legacyEmailAttempt.error ?? phoneAttempt.error ?? new Error('Invalid login credentials');
  }

  return getUserById(legacyEmailAttempt.data.user.id);
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getUserById(id: string): Promise<User | Mechanic | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, mechanics(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  if (data.role === 'mechanic' && data.mechanics) {
    const mechData = Array.isArray(data.mechanics) ? data.mechanics[0] : data.mechanics;
    return { ...data, ...mechData } as Mechanic;
  }
  return data as User;
}

export async function signUp(email: string, password: string, name: string, role: Role, phone?: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role, phone }
    }
  });

  if (authError || !authData.user) throw authError;

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    name,
    email,
    role,
    phone,
  });

  if (profileError) throw profileError;

  if (role === 'mechanic') {
    const { error: mechanicError } = await supabase.from('mechanics').insert({
      id: authData.user.id,
      specialty: 'Geral',
      credentials: 'PENDENTE',
    });
    if (mechanicError) throw mechanicError;
  }
}

export async function getCurrentSessionUser(): Promise<User | Mechanic | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return getUserById(session.user.id);
}
