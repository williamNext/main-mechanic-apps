import { TimeSlot } from '@/types/models';
import { request } from './wire-client';

export interface CreateTimeSlotInput {
  date: string;
  startTime: string;
  endTime: string;
}

export async function getSlotsByMechanic(
  mechanicId: string,
  date: string,
  includeUnavailable = false,
): Promise<TimeSlot[]> {
  const query = `date=${encodeURIComponent(date)}${includeUnavailable ? '&includeUnavailable=true' : ''}`;
  return request<TimeSlot[]>(`/mechanics/${encodeURIComponent(mechanicId)}/timeslots?${query}`);
}

export async function createSlot(slot: CreateTimeSlotInput | CreateTimeSlotInput[]): Promise<TimeSlot[]> {
  return request<TimeSlot[]>('/timeslots', {
    method: 'POST',
    body: slot,
  });
}

export async function updateSlotAvailability(id: string, isAvailable: boolean): Promise<TimeSlot> {
  return request<TimeSlot>(`/timeslots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { isAvailable },
  });
}

export async function deleteSlot(id: string): Promise<void> {
  await request<void>(`/timeslots/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
