import type { CompleteAppointmentBody } from './requests.js';
import type { Role } from './wire.js';

export type { AdminFilters } from '../../../server/src/admin/filters.js';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  specialty: string | null;
  createdAt: string;
  credentials?: string;
}

export interface Mechanic
  extends Omit<User, 'role' | 'specialty' | 'credentials'> {
  role: 'mechanic';
  specialty: string;
  credentials: string;
}

export interface AdminUser extends Omit<User, 'role'> {
  role: 'admin';
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type CompleteAppointmentInput = CompleteAppointmentBody & {
  appointmentId: string;
};
