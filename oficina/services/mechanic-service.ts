import { supabase } from './legacy-supabase-client';
import { Mechanic } from '@/types/models';

export async function getAllMechanics(): Promise<Mechanic[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, mechanics!inner(*)')
    .eq('role', 'mechanic');

  if (error) throw error;

  return data.map((item: any) => ({
    ...item,
    ...item.mechanics,
  })) as Mechanic[];
}

export async function getMechanicById(id: string): Promise<Mechanic | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, mechanics!inner(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    ...data.mechanics,
  } as Mechanic;
}

export async function updateMechanicProfile(id: string, updates: Partial<Mechanic>): Promise<void> {
  // Update profiles part
  const profileUpdates: any = {};
  if (updates.name) profileUpdates.name = updates.name;
  if (updates.avatarUrl) profileUpdates.avatar_url = updates.avatarUrl;
  if (updates.phone) profileUpdates.phone = updates.phone;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', id);
    if (error) throw error;
  }

  // Update mechanics part
  const mechanicUpdates: any = {};
  if (updates.specialty) mechanicUpdates.specialty = updates.specialty;
  if (updates.credentials) mechanicUpdates.credentials = updates.credentials;

  if (Object.keys(mechanicUpdates).length > 0) {
    const { error } = await supabase.from('mechanics').update(mechanicUpdates).eq('id', id);
    if (error) throw error;
  }
}
