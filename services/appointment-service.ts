import { supabase } from './api';
import { Appointment, AppointmentStatus } from '@/types/models';

export async function getAllAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:profiles!client_id(name),
      mechanic:profiles!mechanic_id(name)
    `)
    .order('date', { ascending: false });

  if (error) throw error;

  return data.map((a: any) => ({
    ...a,
    clientName: a.client?.name,
    mechanicName: a.mechanic?.name,
  })) as Appointment[];
}

export async function getAppointmentsByClient(clientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      mechanic:profiles!mechanic_id(name)
    `)
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) throw error;

  return data.map((a: any) => ({
    ...a,
    mechanicName: a.mechanic?.name,
  })) as Appointment[];
}

export async function getAppointmentsByMechanic(mechanicId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      client:profiles!client_id(name)
    `)
    .eq('mechanic_id', mechanicId)
    .order('date', { ascending: false });

  if (error) throw error;

  return data.map((a: any) => ({
    ...a,
    clientName: a.client?.name,
  })) as Appointment[];
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

  return data as Appointment;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
