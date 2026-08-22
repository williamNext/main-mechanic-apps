import { z } from 'zod';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { getSaoPauloDateTimeParts } from '../lib/sao-paulo-time.js';

const PositiveIntegerQueryValue = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z.number().int().positive(),
);

export const AdminFiltersSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(['all', ...APPOINTMENT_STATUSES]).default('all'),
  mechanicId: z.string().trim().min(1).nullable().optional(),
  search: z.string().trim().default(''),
  page: PositiveIntegerQueryValue.optional().default(1),
  pageSize: PositiveIntegerQueryValue.optional()
    .default(20)
    .transform((value) => Math.min(value, 100)),
});

export interface AdminFilters {
  from: string;
  to: string;
  status: 'all' | AppointmentStatus;
  mechanicId?: string | null;
  search: string;
  page: number;
  pageSize: number;
}

export function parseAdminFilters(input: unknown): AdminFilters {
  const parsed = AdminFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, 'invalid filters', 'VALIDATION_FAILED');
  }

  const today = getSaoPauloDateTimeParts().date;
  const from = parsed.data.from ?? `${today.slice(0, 7)}-01`;
  const to = parsed.data.to ?? today;

  if (from > to) {
    throw new HttpError(400, 'invalid date range', 'INVALID_DATE_RANGE');
  }

  return { ...parsed.data, from, to };
}
