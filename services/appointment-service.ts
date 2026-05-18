import { supabase } from './api';
import { Appointment } from '@/types/models';

export interface BookAppointmentInput {
  timeSlotId: string;
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
  return {
    id: a.id,
    clientId: a.client_id,
    mechanicId: a.mechanic_id,
    timeSlotId: a.timeslot_id,
    date: a.date,
    startTime: a.start_time,
    endTime: a.end_time,
    status: a.status,
    vehicleInfo: a.vehicle_info,
    notes: a.notes,
    createdAt: a.created_at,
    clientName: a.clientName,
    clientPhone: a.clientPhone,
    mechanicName: a.mechanicName,
    mechanicPhone: a.mechanicPhone,
  };
}

export async function syncAcabadoAppointments(): Promise<void> {
  const { error } = await supabase.rpc('sync_acabado_appointments');
  if (error) throw error;
}

export async function getAllAppointments(): Promise<Appointment[]> {
  await syncAcabadoAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:profiles!client_id(name)
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
  await syncAcabadoAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select(`*`)
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

export async function getAppointmentsByMechanic(mechanicId: string): Promise<Appointment[]> {
  await syncAcabadoAppointments();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:profiles!client_id(name, phone)
    `)
    .eq('mechanic_id', mechanicId)
    .order('date', { ascending: false });

  if (error) throw error;

  return data.map((a: any) => mapAppointmentRow({
    ...a,
    clientName: a.client?.name ?? undefined,
    clientPhone: a.client?.phone ?? undefined,
  }));
}

export async function createAppointment(appointment: BookAppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase
    .rpc('book_client_appointment', {
      p_timeslot_id: appointment.timeSlotId,
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

export async function cancelMechanicAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_mechanic_appointment', {
    p_appointment_id: appointmentId,
  });

  if (error) throw error;
}
