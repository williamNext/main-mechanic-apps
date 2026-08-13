import { supabase } from './legacy-supabase-client';
import { TimeSlot } from '@/types/models';
import { request } from './api';

export async function getSlotsByMechanic(mechanicId: string, date?: string): Promise<TimeSlot[]> {
  const dateQuery = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<TimeSlot[]>(`/mechanics/${encodeURIComponent(mechanicId)}/timeslots${dateQuery}`);
}

export async function getAvailableSlotsByMechanic(mechanicId: string, date?: string): Promise<TimeSlot[]> {
  const dateQuery = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<TimeSlot[]>(`/mechanics/${encodeURIComponent(mechanicId)}/timeslots${dateQuery}`);
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
  return data as TimeSlot;
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
