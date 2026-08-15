import { z } from 'zod';
import { AdminFilters, AppointmentStatus } from '@/types/models';

const appointmentStatus = z.enum(['all', 'confirmado', 'nao_finalizado', 'cancelado', 'acabado']);

const filtersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: appointmentStatus,
  mechanicId: z.string().trim().min(1).nullable().optional(),
  search: z.string().max(120),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
});

export function getDefaultFilters(): AdminFilters {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;

  return {
    from: `${values.year}-${values.month}-01`,
    to: today,
    status: 'all',
    mechanicId: null,
    search: '',
    page: 1,
    pageSize: 20,
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
    pageSize: Math.min(100, Math.max(1, Number(next.pageSize ?? base.pageSize ?? 20))),
  };

  const parsed = filtersSchema.safeParse(merged);

  if (!parsed.success) {
    return {
      ...getDefaultFilters(),
      search: merged.search,
    };
  }

  return parsed.data;
}

export function isAppointmentStatus(value: string): value is AdminFilters['status'] {
  return appointmentStatus.safeParse(value).success;
}

export const appointmentStatusOptions: Array<{ label: string; value: 'all' | AppointmentStatus }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Confirmados', value: 'confirmado' },
  { label: 'Nao finalizados', value: 'nao_finalizado' },
  { label: 'Finalizados', value: 'acabado' },
  { label: 'Cancelados', value: 'cancelado' },
];
