import { supabase } from './legacy-supabase-client';
import { TimeSlot } from '@/types/models';

function mapSlot(s: any): TimeSlot {
  return {
    id: s.id,
    mechanicId: s.mechanic_id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    isAvailable: s.is_available,
  };
}

function getSaoPauloDateTimeParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
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
  const now = getSaoPauloDateTimeParts();

  if (date && date < now.date) {
    return [];
  }

  let query = supabase
    .from('timeslots')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .eq('is_available', true);

  if (date) {
    query = query.eq('date', date);

    if (date === now.date) {
      query = query.gt('start_time', now.time);
    }
  } else {
    query = query.gte('date', now.date);
  }

  const { data, error } = await query.order('start_time', { ascending: true });

  if (error) throw error;
  return data.map(mapSlot).filter((slot) => slot.date > now.date || slot.startTime > now.time);
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

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase.from('timeslots').delete().eq('id', id);
  if (error) throw error;
}
