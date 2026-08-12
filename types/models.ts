// Domain models — single source of truth for all data shapes

export type Role = 'admin' | 'mechanic' | 'client';

export type AppointmentStatus = 'confirmado' | 'nao_finalizado' | 'cancelado' | 'acabado';
export type NotificationType = 'appointment_confirmed' | 'appointment_canceled' | 'appointment_completed' | 'system';

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
  serviceSummary?: string | null;
  serviceDiagnosis?: string | null;
  workPerformed?: string | null;
  partsUsed?: string | null;
  recommendations?: string | null;
  totalAmountCents?: number | null;
  closedAt?: string | null;
  serviceItems?: ServiceItem[];
  createdAt: string;
}

export interface ServiceItem {
  id?: string;
  description: string;
  amountCents: number;
  sortOrder?: number;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  actorId?: string | null;
  appointmentId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteAppointmentInput {
  appointmentId: string;
  summary: string;
  diagnosis?: string;
  workPerformed: string;
  partsUsed?: string;
  recommendations?: string;
  items: ServiceItem[];
}
