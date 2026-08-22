import { request } from '@main-mechanic/wire-client';
import {
  AdminAppointmentRow,
  AdminDashboardSummary,
  AdminFilterQuery,
  AdminFinancialReport,
  AdminFilters,
  AdminMechanicDetail,
  AdminMechanicRow,
  CreateMechanicInput,
  DeactivateMechanicsInput,
  DeactivateMechanicsResult,
  PaginatedResult,
} from '@main-mechanic/types';

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

export async function fetchDashboardSummary(filters: Pick<AdminFilters, 'from' | 'to'>) {
  const filterQuery = { from: filters.from, to: filters.to } satisfies AdminFilterQuery;
  const query = new URLSearchParams(filterQuery);
  return request<AdminDashboardSummary>(`/admin/dashboard?${query.toString()}`);
}

export async function fetchMechanics(filters: Pick<AdminFilters, 'search' | 'page' | 'pageSize'>) {
  const filterQuery = {
    search: filters.search,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  } satisfies AdminFilterQuery;
  const query = new URLSearchParams(filterQuery);
  return request<PaginatedResult<AdminMechanicRow>>(`/admin/mechanics?${query.toString()}`);
}

export async function fetchAppointments(filters: AdminFilters) {
  const filterQuery = {
    from: filters.from,
    to: filters.to,
    status: filters.status,
    search: filters.search,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  } satisfies AdminFilterQuery;
  const query = new URLSearchParams(filterQuery);
  if (filters.mechanicId) query.set('mechanicId', filters.mechanicId);

  return request<PaginatedResult<AdminAppointmentRow>>(`/admin/appointments?${query.toString()}`);
}

export async function fetchFinancialReport(filters: Pick<AdminFilters, 'from' | 'to' | 'mechanicId' | 'search'>) {
  const filterQuery = {
    from: filters.from,
    to: filters.to,
    search: filters.search,
  } satisfies AdminFilterQuery;
  const query = new URLSearchParams(filterQuery);
  if (filters.mechanicId) query.set('mechanicId', filters.mechanicId);

  return request<AdminFinancialReport>(`/admin/finance?${query.toString()}`);
}

export async function fetchMechanicDetail(mechanicId: string, filters: Pick<AdminFilters, 'from' | 'to'>) {
  const filterQuery = { from: filters.from, to: filters.to } satisfies AdminFilterQuery;
  const query = new URLSearchParams(filterQuery);
  return request<AdminMechanicDetail>(`/admin/mechanics/${encodeURIComponent(mechanicId)}?${query.toString()}`);
}

export async function deactivateMechanics(mechanicIds: string[]) {
  const ids = Array.from(new Set(mechanicIds.filter(Boolean)));

  if (ids.length === 0) {
    throw new Error('Selecione ao menos um mecânico');
  }

  return request<DeactivateMechanicsResult>('/admin/mechanics/deactivate', {
    method: 'POST',
    body: { mechanicIds: ids } satisfies DeactivateMechanicsInput,
  });
}

export async function createMechanic(params: CreateMechanicInput) {
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
