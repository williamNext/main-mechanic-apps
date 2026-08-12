import { supabase } from './api';
import { Mechanic } from '@/types/models';

function mapPublicMechanicRow(item: any): Mechanic {
  return {
    id: item.id,
    name: item.name,
    role: 'mechanic',
    specialty: item.specialty,
    credentials: '',
    avatarUrl: item.avatar_url ?? undefined,
    isActive: true,
  } as Mechanic;
}

export async function getAllMechanics(): Promise<Mechanic[]> {
  const { data, error } = await supabase
    .from('public_mechanics')
    .select('id, name, specialty, avatar_url')
    .order('name', { ascending: true });

  if (error) throw error;

  return data.map(mapPublicMechanicRow);
}

export async function getMechanicById(id: string): Promise<Mechanic | null> {
  const { data, error } = await supabase
    .from('public_mechanics')
    .select('id, name, specialty, avatar_url')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return mapPublicMechanicRow(data);
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

  if (Object.keys(mechanicUpdates).length > 0) {
    const { error } = await supabase.from('mechanics').update(mechanicUpdates).eq('id', id);
    if (error) throw error;
  }
}
