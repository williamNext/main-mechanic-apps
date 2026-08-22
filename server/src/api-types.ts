import type { z } from 'zod';
import { AdminFiltersSchema } from './admin/filters.js';
import {
  serializeAppointment,
  type ServiceItem as SerializedServiceItem,
} from './appointments/serializer.js';
import { APPOINTMENT_STATUSES, ROLES } from './db/schema.js';
import { CreateMechanicSchema, DeactivateMechanicsSchema } from './routes/admin.js';
import { BookAppointmentSchema, CompleteAppointmentSchema } from './routes/appointments.js';
import { CreateTimeslotSchema, UpdateTimeslotSchema } from './routes/mechanics.js';
import { UpdateProfileSchema } from './routes/profiles.js';
import { serializeProfileUser } from './routes/user.js';

export type Role = (typeof ROLES)[number];
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type Appointment = ReturnType<typeof serializeAppointment>;
export type ServiceItem = SerializedServiceItem;
export type ProfileUserResponse = ReturnType<typeof serializeProfileUser>;
export type AuthResponse = {
  token: string;
  user: ProfileUserResponse;
};

export type PublicMechanic = {
  id: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  updatedAt: string;
};

export type TimeSlot = {
  id: string;
  mechanicId: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  hasActiveAppointment: boolean;
};

export type NotificationType =
  | 'appointment_confirmed'
  | 'appointment_canceled'
  | 'appointment_completed';

export type AppNotification = {
  id: string;
  recipientId: string;
  appointmentId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type AdminDashboardSummary = {
  range: {
    from: string;
    to: string;
  };
  generatedAt: string;
  mechanics: {
    total: number;
    active: number;
  };
  appointments: {
    total: number;
    confirmed: number;
    unfinished: number;
    finished: number;
    canceled: number;
    today: number;
    revenueCents: number;
  };
  slots: {
    upcomingAvailable: number;
    upcomingBlocked: number;
  };
  appointmentsByDay: Array<{
    date: string;
    total: number;
    confirmed: number;
    unfinished: number;
    finished: number;
    canceled: number;
    revenueCents: number;
  }>;
  topMechanics: Array<{
    mechanicId: string;
    mechanicName: string;
    specialty: string;
    appointments: number;
    revenueCents: number;
  }>;
};

export type AdminMechanicRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  specialty: string;
  credentials: string;
  isActive: boolean;
  appointmentsTotal: number;
  appointmentsConfirmed: number;
  lastAppointmentDate: string | null;
};

export type AdminAppointmentRow = {
  id: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  mechanicId: string;
  mechanicName: string | null;
  mechanicPhone: string | null;
  specialty: string | null;
  timeSlotId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  vehicleInfo: string | null;
  notes: string | null;
  serviceSummary: string | null;
  serviceDiagnosis: string | null;
  workPerformed: string | null;
  partsUsed: string | null;
  recommendations: string | null;
  totalAmountCents: number | null;
  closedAt: string | null;
  createdAt: string;
  serviceItems: ServiceItem[];
};

export type AdminFinancialReport = {
  range: {
    from: string;
    to: string;
  };
  generatedAt: string;
  summary: {
    appointments: number;
    revenueCents: number;
    averageTicketCents: number;
  };
  revenueByDay: Array<{
    date: string;
    appointments: number;
    revenueCents: number;
  }>;
  revenueByMonth: Array<{
    month: string;
    appointments: number;
    revenueCents: number;
  }>;
  byMechanic: Array<{
    mechanicId: string;
    mechanicName: string;
    specialty: string;
    appointments: number;
    revenueCents: number;
  }>;
  byService: Array<{
    description: string;
    quantity: number;
    revenueCents: number;
  }>;
  appointments: Array<{
    id: string;
    date: string;
    clientName: string | null;
    mechanicName: string;
    vehicleInfo: string | null;
    serviceSummary: string;
    totalAmountCents: number;
    closedAt: string;
  }>;
};

export type AdminMechanicDetail = {
  mechanic: AdminMechanicRow;
  range: {
    from: string;
    to: string;
  };
  appointmentStats: {
    total: number;
    confirmed: number;
    unfinished: number;
    finished: number;
    canceled: number;
  };
  slotStats: {
    totalUpcoming: number;
    availableUpcoming: number;
  };
  recentAppointments: AdminAppointmentRow[];
};

export type DeactivateMechanicsResult = {
  deactivatedCount: number;
  requestedCount: number;
  ignoredCount: number;
  cancelledAppointmentCount: number;
};

export type BookAppointmentInput = z.input<typeof BookAppointmentSchema>;
export type CompleteAppointmentBody = z.input<typeof CompleteAppointmentSchema>;
export type ServiceItemInput = CompleteAppointmentBody['items'][number];
export type AdminFilterQuery = z.input<typeof AdminFiltersSchema>;
export type CreateTimeSlotInput = z.input<typeof CreateTimeslotSchema>;
export type UpdateTimeSlotInput = z.input<typeof UpdateTimeslotSchema>;
export type CreateMechanicInput = z.input<typeof CreateMechanicSchema>;
export type DeactivateMechanicsInput = z.input<typeof DeactivateMechanicsSchema>;
export type UpdateProfileInput = z.input<typeof UpdateProfileSchema>;
