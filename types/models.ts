export type Role = 'admin' | 'mechanic' | 'client';

export type AppointmentStatus = 'confirmado' | 'nao_finalizado' | 'cancelado' | 'acabado';

export type MechanicApprovalStatus = 'all' | 'pending' | 'active' | 'inactive';

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
  createdAt: string;
}

export interface AdminUser extends User {
  role: 'admin';
}

export interface AdminFilters {
  from: string;
  to: string;
  status: 'all' | AppointmentStatus;
  mechanicStatus: MechanicApprovalStatus;
  mechanicId?: string | null;
  search: string;
  page: number;
  pageSize: number;
}

export interface AdminDashboardSummary {
  range: {
    from: string;
    to: string;
  };
  generatedAt: string;
  mechanics: {
    total: number;
    active: number;
    pending: number;
    inactive: number;
  };
  appointments: {
    total: number;
    confirmed: number;
    unfinished: number;
    finished: number;
    canceled: number;
    today: number;
    revenueCents?: number;
  };
  slots: {
    upcomingAvailable: number;
    upcomingBlocked: number;
  };
  appointmentsByDay: Array<{
    date: string;
    total: number;
    confirmed: number;
    unfinished?: number;
    finished: number;
    canceled: number;
    revenueCents?: number;
  }>;
  topMechanics: Array<{
    mechanicId: string;
    mechanicName: string;
    specialty: string;
    appointments: number;
    revenueCents?: number;
  }>;
}

export interface AdminMechanicRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  specialty: string;
  credentials: string;
  isActive: boolean;
  appointmentsTotal?: number;
  appointmentsConfirmed?: number;
  lastAppointmentDate?: string | null;
}

export interface AdminAppointmentRow {
  id: string;
  clientId: string;
  clientName?: string | null;
  clientPhone?: string | null;
  mechanicId: string;
  mechanicName?: string | null;
  mechanicPhone?: string | null;
  specialty?: string | null;
  timeSlotId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  vehicleInfo?: string | null;
  notes?: string | null;
  serviceSummary?: string | null;
  serviceDiagnosis?: string | null;
  workPerformed?: string | null;
  partsUsed?: string | null;
  recommendations?: string | null;
  totalAmountCents?: number | null;
  closedAt?: string | null;
  serviceItems?: AdminServiceItem[];
  createdAt: string;
}

export interface AdminServiceItem {
  id?: string;
  description: string;
  amountCents: number;
  sortOrder?: number;
}

export interface AdminFinancialReport {
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
    clientName?: string | null;
    mechanicName?: string | null;
    vehicleInfo?: string | null;
    serviceSummary?: string | null;
    totalAmountCents: number;
    closedAt: string;
  }>;
}

export interface AdminApprovalAction {
  mechanicId: string;
  approved: boolean;
  credentials?: string | null;
  note?: string | null;
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminMechanicDetail {
  mechanic: AdminMechanicRow;
  range: {
    from: string;
    to: string;
  };
  appointmentStats: {
    total: number;
    confirmed: number;
    unfinished?: number;
    finished: number;
    canceled: number;
  };
  slotStats: {
    totalUpcoming: number;
    availableUpcoming: number;
  };
  recentAppointments: AdminAppointmentRow[];
  approvalHistory: Array<{
    id: string;
    action: 'approve_mechanic' | 'reject_mechanic';
    note?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    createdAt: string;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
  }>;
}
