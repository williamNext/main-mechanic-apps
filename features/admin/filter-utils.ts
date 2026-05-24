import { endOfMonth, format, startOfMonth } from 'date-fns';
import { z } from 'zod';
import { AdminFilters, AppointmentStatus, MechanicApprovalStatus } from '@/types/models';

const appointmentStatus = z.enum(['all', 'confirmado', 'nao_finalizado', 'cancelado', 'acabado']);
const mechanicStatus = z.enum(['all', 'pending', 'active', 'inactive']);

const filtersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: appointmentStatus,
  mechanicStatus,
  mechanicId: z.string().uuid().nullable().optional(),
  search: z.string().max(120),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export function getDefaultFilters(): AdminFilters {
  const now = new Date();

  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
    status: 'all',
    mechanicStatus: 'all',
    mechanicId: null,
    search: '',
    page: 1,
    pageSize: 25,
  };
}

export function sanitizeFilters(next: Partial<AdminFilters>, base: AdminFilters = getDefaultFilters()): AdminFilters {
  const nextMechanicId = Object.prototype.hasOwnProperty.call(next, 'mechanicId') ? next.mechanicId : base.mechanicId;
  const merged = {
    ...base,
    ...next,
    search: (next.search ?? base.search ?? '').trim().slice(0, 120),
    mechanicId: nextMechanicId === '' ? null : nextMechanicId ?? null,
    page: Math.max(1, Number(next.page ?? base.page ?? 1)),
    pageSize: Math.min(100, Math.max(1, Number(next.pageSize ?? base.pageSize ?? 25))),
  };

  const parsed = filtersSchema.safeParse(merged);

  if (!parsed.success) {
    return {
      ...getDefaultFilters(),
      search: merged.search,
    };
  }

  if (parsed.data.to < parsed.data.from) {
    return {
      ...parsed.data,
      to: parsed.data.from,
    };
  }

  return parsed.data;
}

export function isAppointmentStatus(value: string): value is AdminFilters['status'] {
  return appointmentStatus.safeParse(value).success;
}

export function isMechanicStatus(value: string): value is MechanicApprovalStatus {
  return mechanicStatus.safeParse(value).success;
}

export const appointmentStatusOptions: Array<{ label: string; value: 'all' | AppointmentStatus }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Confirmados', value: 'confirmado' },
  { label: 'Nao finalizados', value: 'nao_finalizado' },
  { label: 'Finalizados', value: 'acabado' },
  { label: 'Cancelados', value: 'cancelado' },
];

export const mechanicStatusOptions: Array<{ label: string; value: MechanicApprovalStatus }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];
