import { request } from '@main-mechanic/wire-client';
import {
  AdminAppointmentRow,
  AdminDashboardSummary,
  AdminFinancialReport,
  AdminFilters,
  AdminMechanicDetail,
  AdminMechanicRow,
  DeactivateMechanicsResult,
  PaginatedResult,
} from '@/types/models';

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

export async function fetchDashboardSummary(filters: Pick<AdminFilters, 'from' | 'to'>) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  return request<AdminDashboardSummary>(`/admin/dashboard?${query.toString()}`);
}

export async function fetchMechanics(filters: Pick<AdminFilters, 'search' | 'page' | 'pageSize'>) {
  const query = new URLSearchParams({
    search: filters.search,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  return request<PaginatedResult<AdminMechanicRow>>(`/admin/mechanics?${query.toString()}`);
}

export async function fetchAppointments(filters: AdminFilters) {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    status: filters.status,
    search: filters.search,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.mechanicId) query.set('mechanicId', filters.mechanicId);

  return request<PaginatedResult<AdminAppointmentRow>>(`/admin/appointments?${query.toString()}`);
}

export async function fetchFinancialReport(filters: Pick<AdminFilters, 'from' | 'to' | 'mechanicId' | 'search'>) {
  const query = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    search: filters.search,
  });
  if (filters.mechanicId) query.set('mechanicId', filters.mechanicId);

  return request<AdminFinancialReport>(`/admin/finance?${query.toString()}`);
}

export async function fetchMechanicDetail(mechanicId: string, filters: Pick<AdminFilters, 'from' | 'to'>) {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  return request<AdminMechanicDetail>(`/admin/mechanics/${encodeURIComponent(mechanicId)}?${query.toString()}`);
}

export async function deactivateMechanics(mechanicIds: string[]) {
  const ids = Array.from(new Set(mechanicIds.filter(Boolean)));

  if (ids.length === 0) {
    throw new Error('Selecione ao menos um mecânico');
  }

  return request<DeactivateMechanicsResult>('/admin/mechanics/deactivate', {
    method: 'POST',
    body: { mechanicIds: ids },
  });
}

export async function createMechanic(params: {
  name: string;
  phone: string;
  email: string;
  password: string;
  specialty: string;
  credentials: string;
}) {
  return request<AdminMechanicRow>('/admin/mechanics', {
    method: 'POST',
    body: {
      ...params,
      phone: normalizePhoneToE164(params.phone),
    },
  });
}

export async function reactivateMechanic(mechanicId: string) {
  return request<AdminMechanicRow>(`/admin/mechanics/${encodeURIComponent(mechanicId)}/reactivate`, {
    method: 'POST',
  });
}
