import { supabase } from '@/services/api';
import {
  AdminAppointmentRow,
  AdminDashboardSummary,
  AdminFinancialReport,
  AdminFilters,
  AdminMechanicDetail,
  AdminMechanicRow,
  PaginatedResult,
} from '@/types/models';

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

function raiseRpcError(error: unknown): never {
  const candidate = error as { message?: string; details?: string };
  throw new Error(candidate?.message ?? candidate?.details ?? 'Falha na solicitacao administrativa');
}

function ensureData<T>(data: T | null, error: unknown): T {
  if (error) raiseRpcError(error);
  if (data === null || data === undefined) throw new Error('Solicitacao administrativa nao retornou dados');
  return data;
}

export async function fetchDashboardSummary(filters: Pick<AdminFilters, 'from' | 'to'>) {
  const { data, error } = await supabase.rpc('admin_dashboard_summary', {
    p_from: filters.from,
    p_to: filters.to,
  });

  return ensureData<AdminDashboardSummary>(data as AdminDashboardSummary | null, error);
}

export async function fetchMechanics(filters: Pick<AdminFilters, 'search' | 'page' | 'pageSize'>) {
  const { data, error } = await supabase.rpc('admin_list_mechanics', {
    p_search: filters.search || null,
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

export async function deleteMechanics(mechanicIds: string[]) {
  const ids = Array.from(new Set(mechanicIds.filter(Boolean)));

  if (ids.length === 0) {
    throw new Error('Selecione ao menos um mecanico');
  }

  const { data, error } = await supabase.functions.invoke('admin-delete-mechanics', {
    body: { mechanicIds: ids },
  });

  return ensureData<{ deletedCount: number; requestedCount: number }>(
    data as { deletedCount: number; requestedCount: number } | null,
    error
  );
}

export async function createMechanic(params: {
  nome: string;
  celular: string;
  email: string;
  senha: string;
  especialidade: string;
  credenciais: string;
}) {
  const normalizedPhone = normalizePhoneToE164(params.celular);

  const { data, error } = await supabase.functions.invoke('admin-create-mechanic', {
    body: {
      ...params,
      celular: normalizedPhone,
    },
  });

  if (error) raiseRpcError(error);

  return ensureData(data, error);
}
