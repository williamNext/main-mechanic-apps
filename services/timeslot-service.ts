import { supabase } from './api';
import { TimeSlot } from '@/types/models';

function normalizeTime(value: string): string {
  if (!value) return value;
  return value.slice(0, 5);
}

function mapSlot(s: any): TimeSlot {
  return {
    id: s.id,
    mechanicId: s.mechanic_id,
    date: s.date,
    startTime: normalizeTime(s.start_time),
    endTime: normalizeTime(s.end_time),
    isAvailable: s.is_available,
  };
}

export async function getSlotsByMechanic(mechanicId: string, date?: string): Promise<TimeSlot[]> {
  let query = supabase
    .from('timeslots')
    .select('*')
    .eq('mechanic_id', mechanicId);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query.order('start_time', { ascending: true });

  if (error) throw error;
  return data.map(mapSlot);
}

export async function getAvailableSlotsByMechanic(mechanicId: string, date?: string): Promise<TimeSlot[]> {
  let query = supabase
    .from('timeslots')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .eq('is_available', true);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query.order('start_time', { ascending: true });

  if (error) throw error;
  return data.map(mapSlot);
}

export async function createSlot(slot: Omit<TimeSlot, 'id'>): Promise<TimeSlot> {
  const { data, error } = await supabase
    .from('timeslots')
    .insert({
      mechanic_id: slot.mechanicId,
      date: slot.date,
      start_time: slot.startTime,
      end_time: slot.endTime,
      is_available: slot.isAvailable,
    })
    .select()
    .single();

  if (error) throw error;
  return mapSlot(data);
}

export async function updateSlotAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase
    .from('timeslots')
    .update({ is_available: isAvailable })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSlot(id: string, mechanicId: string): Promise<string> {
  const { data, error } = await supabase
    .from('timeslots')
    .delete()
    .eq('id', id)
    .eq('mechanic_id', mechanicId)
    .eq('is_available', true)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Horario nao encontrado, reservado ou sem permissao para excluir.');
  }

  return data.id;
}
