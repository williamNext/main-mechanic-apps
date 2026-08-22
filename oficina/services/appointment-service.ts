import { Appointment } from '@/types/models';
import { isApiError, request } from '@main-mechanic/wire-client';

export interface BookAppointmentInput {
  timeSlotId: string;
  vehicleInfo?: string;
  notes?: string;
}

export async function getAppointmentsByClient(): Promise<Appointment[]> {
  return request<Appointment[]>('/appointments');
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  try {
    return await request<Appointment>(`/appointments/${encodeURIComponent(id)}`);
  } catch (error) {
    if (isApiError(error) && error.code === 'APPOINTMENT_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

export async function createAppointment(data: BookAppointmentInput): Promise<Appointment> {
  return request<Appointment>('/appointments', {
    method: 'POST',
    body: data,
  });
}

export async function cancelClientAppointment(appointmentId: string): Promise<Appointment> {
  return request<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: 'POST',
  });
}
