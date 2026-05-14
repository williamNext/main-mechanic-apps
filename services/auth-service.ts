import { supabase } from './api';
import { User, Mechanic, Role } from '@/types/models';

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

export async function signUp(email: string, password: string, name: string, role: Role): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, role }
    }
  });

  if (authError || !authData.user) throw authError;

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    name,
    email,
    role,
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
