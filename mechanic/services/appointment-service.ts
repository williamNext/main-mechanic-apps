import { Appointment, CompleteAppointmentInput } from '@main-mechanic/types';
import { isApiError, request } from '@main-mechanic/wire-client';

export async function getAppointmentsByMechanic(): Promise<Appointment[]> {
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

export async function cancelMechanicAppointment(appointmentId: string): Promise<Appointment> {
  return request<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, {
    method: 'POST',
  });
}

export async function completeMechanicAppointment(input: CompleteAppointmentInput): Promise<Appointment> {
  return request<Appointment>(`/appointments/${encodeURIComponent(input.appointmentId)}/complete`, {
    method: 'POST',
    body: {
      summary: input.summary,
      diagnosis: input.diagnosis,
      workPerformed: input.workPerformed,
      partsUsed: input.partsUsed,
      recommendations: input.recommendations,
      items: input.items.map((item) => ({
        description: item.description,
        amountCents: item.amountCents,
      })),
    },
  });
}
