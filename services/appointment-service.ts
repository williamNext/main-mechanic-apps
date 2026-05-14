import { supabase } from './api';
import { Appointment, AppointmentStatus } from '@/types/models';

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
    mechanicName: a.mechanicName,
    mechanicPhone: a.mechanicPhone,
  };
}

export async function getAllAppointments(): Promise<Appointment[]> {
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

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      client_id: appointment.clientId,
      mechanic_id: appointment.mechanicId,
      timeslot_id: appointment.timeSlotId,
      date: appointment.date,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      vehicle_info: appointment.vehicleInfo,
      notes: appointment.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Mark timeslot as unavailable
  await supabase
    .from('timeslots')
    .update({ is_available: false })
    .eq('id', appointment.timeSlotId);

  return mapAppointmentRow(data);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
