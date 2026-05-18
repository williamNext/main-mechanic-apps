import { supabase } from './api';
import { Mechanic } from '@/types/models';

function mapMechanicRow(item: any): Mechanic {
  const mechanic = Array.isArray(item.mechanics) ? item.mechanics[0] : item.mechanics;

  return {
    ...item,
    ...mechanic,
    avatarUrl: item.avatar_url ?? undefined,
    isActive: mechanic?.is_active,
  } as Mechanic;
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, mechanics!inner(*)')
    .eq('role', 'mechanic');

  if (error) throw error;

  return data.map(mapMechanicRow);
}

export async function getMechanicById(id: string): Promise<Mechanic | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, mechanics!inner(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return mapMechanicRow(data);
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
  if (updates.isActive !== undefined) mechanicUpdates.is_active = updates.isActive;

  if (Object.keys(mechanicUpdates).length > 0) {
    const { error } = await supabase.from('mechanics').update(mechanicUpdates).eq('id', id);
    if (error) throw error;
  }
}
