import { supabase } from '@/services/api';
import {
  AdminApprovalAction,
  AdminAppointmentRow,
  AdminDashboardSummary,
  AdminFinancialReport,
  AdminFilters,
  AdminMechanicDetail,
  AdminMechanicRow,
  PaginatedResult,
} from '@/types/models';

function raiseRpcError(error: unknown): never {
  const candidate = error as { message?: string; details?: string };
  throw new Error(candidate?.message ?? candidate?.details ?? 'Falha na solicitação administrativa');
}

function ensureData<T>(data: T | null, error: unknown): T {
  if (error) raiseRpcError(error);
  if (data === null || data === undefined) throw new Error('Solicitação administrativa não retornou dados');
  return data;
}

export async function fetchDashboardSummary(filters: Pick<AdminFilters, 'from' | 'to'>) {
  const { data, error } = await supabase.rpc('admin_dashboard_summary', {
    p_from: filters.from,
    p_to: filters.to,
  });

  return ensureData<AdminDashboardSummary>(data as AdminDashboardSummary | null, error);
}

export async function fetchMechanics(filters: Pick<AdminFilters, 'search' | 'mechanicStatus' | 'page' | 'pageSize'>) {
  const { data, error } = await supabase.rpc('admin_list_mechanics', {
    p_search: filters.search || null,
    p_status: filters.mechanicStatus,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  });

  return ensureData<PaginatedResult<AdminMechanicRow>>(data as PaginatedResult<AdminMechanicRow> | null, error);
}

export async function fetchAppointments(filters: AdminFilters) {
  const { data, error } = await supabase.rpc('admin_list_appointments', {
    p_from: filters.from,
    p_to: filters.to,
    p_status: filters.status,
    p_mechanic_id: filters.mechanicId || null,
    p_search: filters.search || null,
    p_page: filters.page,
    p_page_size: filters.pageSize,
  });

  return ensureData<PaginatedResult<AdminAppointmentRow>>(data as PaginatedResult<AdminAppointmentRow> | null, error);
}

export async function fetchFinancialReport(filters: Pick<AdminFilters, 'from' | 'to' | 'mechanicId' | 'search'>) {
  const { data, error } = await supabase.rpc('admin_financial_report', {
    p_from: filters.from,
    p_to: filters.to,
    p_mechanic_id: filters.mechanicId || null,
    p_search: filters.search || null,
  });

  return ensureData<AdminFinancialReport>(data as AdminFinancialReport | null, error);
}

export async function fetchMechanicDetail(mechanicId: string, filters: Pick<AdminFilters, 'from' | 'to'>) {
  const { data, error } = await supabase.rpc('admin_get_mechanic_detail', {
    p_mechanic_id: mechanicId,
    p_from: filters.from,
    p_to: filters.to,
  });

  return ensureData<AdminMechanicDetail>(data as AdminMechanicDetail | null, error);
}

export async function setMechanicApproval(action: AdminApprovalAction) {
  const { data, error } = await supabase.rpc('admin_set_mechanic_approval', {
    p_mechanic_id: action.mechanicId,
    p_approved: action.approved,
    p_credentials: action.credentials || null,
    p_note: action.note || null,
  });

  return ensureData<Partial<AdminMechanicRow>>(data as Partial<AdminMechanicRow> | null, error);
}
