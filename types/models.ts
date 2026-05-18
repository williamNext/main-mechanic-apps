// Domain models — single source of truth for all data shapes

export type Role = 'admin' | 'mechanic' | 'client';

export type AppointmentStatus = 'confirmado' | 'cancelado' | 'acabado';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  avatarUrl?: string;
  phone?: string;
  createdAt: string;
}

export interface Mechanic extends User {
  role: 'mechanic';
  specialty: string;
  credentials: string;
  isActive?: boolean;
}

export interface TimeSlot {
  id: string;
  mechanicId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  isAvailable: boolean;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  mechanicId: string;
  mechanicName?: string;
  mechanicPhone?: string;
  timeSlotId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  vehicleInfo?: string;
  notes?: string;
  createdAt: string;
}
