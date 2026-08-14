import { supabase } from './api';
import { Mechanic, User } from '@/types/models';
import { request } from './wire-client';

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

export async function updateMyProfile(data: Pick<Mechanic, 'name' | 'specialty'>): Promise<User> {
  return request<User>('/profiles/me', {
    method: 'PATCH',
    body: { name: data.name, specialty: data.specialty },
  });
}
