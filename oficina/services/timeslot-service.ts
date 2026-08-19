import { TimeSlot } from '@/types/models';
import { request } from '@main-mechanic/wire-client';

export async function getAvailableSlotsByMechanic(mechanicId: string, date?: string): Promise<TimeSlot[]> {
  const dateQuery = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<TimeSlot[]>(`/mechanics/${encodeURIComponent(mechanicId)}/timeslots${dateQuery}`);
}
