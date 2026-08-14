import { supabase } from './api';
import { Appointment, CompleteAppointmentInput } from '@/types/models';
import { isApiError, request } from './wire-client';

export type { CompleteAppointmentInput };

export interface BookAppointmentInput {
  timeslotId: string;
  vehicleInfo?: string;
  notes?: string;
}

function isMissingBookingRpcError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string; details?: string };
  const text = `${candidate.message ?? ''} ${candidate.details ?? ''}`.toLowerCase();

  return candidate.code === 'PGRST202' || (
    text.includes('book_client_appointment') &&
    (text.includes('schema cache') || text.includes('could not find the function'))
  );
}

function mapAppointmentRow(a: any): Appointment {
  const reportList = a.appointment_service_reports;
  const report = Array.isArray(reportList) ? reportList[0] : (reportList || {});

  return {
    id: a.id,
    clientId: a.client_id,
    mechanicId: a.mechanic_id,
    timeslotId: a.timeslot_id,
    date: a.date,
    startTime: a.start_time,
    endTime: a.end_time,
    status: a.status,
    vehicleInfo: a.vehicle_info,
    notes: a.notes,
    serviceSummary: report.summary ?? a.service_summary ?? a.serviceSummary,
    serviceDiagnosis: report.diagnosis ?? a.service_diagnosis ?? a.serviceDiagnosis,
    workPerformed: report.work_performed ?? a.work_performed ?? a.workPerformed,
    partsUsed: report.parts_used ?? a.parts_used ?? a.partsUsed,
    recommendations: report.recommendations ?? a.recommendations,
    totalAmountCents: report.total_amount_cents ?? a.total_amount_cents ?? a.totalAmountCents,
    closedAt: report.closed_at ?? a.closed_at ?? a.closedAt,
    serviceItems: a.service_items ?? a.serviceItems ?? [],
    createdAt: a.created_at,
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    mechanicName: a.mechanicName,
    mechanicPhone: a.mechanicPhone,
  };
}

export async function syncUnfinalizedAppointments(): Promise<void> {
  const { error } = await supabase.rpc('sync_unfinalized_appointments');
  if (error) throw error;
}

export async function getAllAppointments(): Promise<Appointment[]> {
  await syncUnfinalizedAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:profiles!client_id(name),
      appointment_service_reports (
        summary,
        diagnosis,
        work_performed,
        parts_used,
        recommendations,
        total_amount_cents,
        closed_at
      )
    `)
    .order('date', { ascending: false });

  if (error) throw error;

  // Fetch mechanic profiles manually to avoid PostgREST nested join issues
  const mechanicIds = [...new Set(data.map((a: any) => a.mechanic_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', mechanicIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return data.map((a: any) => mapAppointmentRow({
    ...a,
    clientName: a.client?.name ?? undefined,
    mechanicName: profileMap.get(a.mechanic_id)?.name ?? undefined,
    mechanicPhone: profileMap.get(a.mechanic_id)?.phone ?? undefined,
  }));
}

export async function getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
  await syncUnfinalizedAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_service_reports (
        summary,
        diagnosis,
        work_performed,
        parts_used,
        recommendations,
        total_amount_cents,
        closed_at
      )
    `)
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) throw error;

  const mechanicIds = [...new Set(data.map((a: any) => a.mechanic_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .in('id', mechanicIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  return data.map((a: any) => mapAppointmentRow({
    ...a,
    mechanicName: profileMap.get(a.mechanic_id)?.name ?? undefined,
    mechanicPhone: profileMap.get(a.mechanic_id)?.phone ?? undefined,
  }));
}

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

export async function createAppointment(appointment: BookAppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase
    .rpc('book_client_appointment', {
      p_timeslot_id: appointment.timeslotId,
      p_vehicle_info: appointment.vehicleInfo ?? null,
      p_notes: appointment.notes ?? null,
    });

  if (error) {
    if (isMissingBookingRpcError(error)) {
      throw new Error(
        'RPC de reserva ausente no Supabase. Execute scripts/sql/2026-05-16_fix_book_client_appointment_rpc.sql e tente novamente.',
      );
    }

    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Agendamento não criado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .eq('id', row.mechanic_id)
    .single();

  return mapAppointmentRow({
    ...row,
    mechanicName: profile?.name ?? undefined,
    mechanicPhone: profile?.phone ?? undefined,
  });
}

export async function cancelClientAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_client_appointment', {
    p_appointment_id: appointmentId,
  });

  if (error) throw error;
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
