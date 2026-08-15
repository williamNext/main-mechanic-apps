import { randomUUID } from 'node:crypto';
import { count, eq, gte, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseAdminFilters } from '../admin/filters.js';
import { requireAdmin } from '../admin/guard.js';
import { syncUnfinalized } from '../appointments/sync-unfinalized.js';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { hashPassword } from '../auth/hash.js';
import type { Db } from '../db/client.js';
import { appointmentServiceReports, appointments, mechanics, profiles, timeslots } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { getSaoPauloDateTimeParts } from '../lib/sao-paulo-time.js';

const CreateMechanicSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  specialty: z.string().trim().min(1),
  credentials: z.string().trim().min(1),
  isActive: z.unknown().optional(),
}).strict();

type AdminMechanicResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  specialty: string;
  credentials: string;
  isActive: boolean;
};

function isProfilesEmailUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    error.message.includes('profiles.email')
  );
}

function countWhere(predicate: SQL): SQL<number> {
  return sql<number>`coalesce(sum(case when ${predicate} then 1 else 0 end), 0)`.mapWith(Number);
}

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getAdminDashboard(db: Db, from: string, to: string, today: string) {
  const mechanicCounts = db
    .select({
      total: count(mechanics.id),
      active: countWhere(eq(mechanics.isActive, true)),
    })
    .from(mechanics)
    .get()!;

  const slotCounts = db
    .select({
      upcomingAvailable: countWhere(eq(timeslots.isAvailable, true)),
      upcomingBlocked: countWhere(eq(timeslots.isAvailable, false)),
    })
    .from(timeslots)
    .where(gte(timeslots.date, today))
    .get()!;

  const rangeAppointments = db
    .select({
      id: appointments.id,
      mechanicId: appointments.mechanicId,
      date: appointments.date,
      status: appointments.status,
      reportRevenueCents: appointmentServiceReports.totalAmountCents,
    })
    .from(appointments)
    .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(sql`${appointments.date} between ${from} and ${to}`)
    .all();

  const appointmentCounts = {
    total: 0,
    confirmed: 0,
    unfinished: 0,
    finished: 0,
    canceled: 0,
    today: 0,
    revenueCents: 0,
  };
  const dailyByDate = new Map<string, Omit<(typeof appointmentCounts), 'today'> & { date: string }>();
  const mechanicActivity = new Map<string, { appointments: number; revenueCents: number }>();

  for (const appointment of rangeAppointments) {
    appointmentCounts.total += 1;
    if (appointment.status === 'confirmado') appointmentCounts.confirmed += 1;
    if (appointment.status === 'nao_finalizado') appointmentCounts.unfinished += 1;
    if (appointment.status === 'acabado') appointmentCounts.finished += 1;
    if (appointment.status === 'cancelado') appointmentCounts.canceled += 1;
    if (appointment.date === today) appointmentCounts.today += 1;

    const revenueCents = appointment.status === 'acabado' ? (appointment.reportRevenueCents ?? 0) : 0;
    appointmentCounts.revenueCents += revenueCents;

    const daily = dailyByDate.get(appointment.date) ?? {
      date: appointment.date,
      total: 0,
      confirmed: 0,
      unfinished: 0,
      finished: 0,
      canceled: 0,
      revenueCents: 0,
    };
    daily.total += 1;
    if (appointment.status === 'confirmado') daily.confirmed += 1;
    if (appointment.status === 'nao_finalizado') daily.unfinished += 1;
    if (appointment.status === 'acabado') daily.finished += 1;
    if (appointment.status === 'cancelado') daily.canceled += 1;
    daily.revenueCents += revenueCents;
    dailyByDate.set(appointment.date, daily);

    const activity = mechanicActivity.get(appointment.mechanicId) ?? { appointments: 0, revenueCents: 0 };
    activity.appointments += 1;
    activity.revenueCents += revenueCents;
    mechanicActivity.set(appointment.mechanicId, activity);
  }

  const appointmentsByDay = [];
  for (let date = from; date <= to; date = nextDate(date)) {
    appointmentsByDay.push(
      dailyByDate.get(date) ?? {
        date,
        total: 0,
        confirmed: 0,
        unfinished: 0,
        finished: 0,
        canceled: 0,
        revenueCents: 0,
      },
    );
  }

  const topMechanics = db
    .select({
      mechanicId: mechanics.id,
      mechanicName: profiles.name,
      specialty: mechanics.specialty,
    })
    .from(mechanics)
    .innerJoin(profiles, eq(profiles.id, mechanics.id))
    .all()
    .flatMap((mechanic) => {
      const activity = mechanicActivity.get(mechanic.mechanicId);
      return activity ? [{ ...mechanic, ...activity }] : [];
    })
    .sort(
      (left, right) =>
        right.revenueCents - left.revenueCents ||
        right.appointments - left.appointments ||
        compareText(left.mechanicName, right.mechanicName) ||
        compareText(left.mechanicId, right.mechanicId),
    )
    .slice(0, 5);

  return {
    range: { from, to },
    generatedAt: new Date().toISOString(),
    mechanics: mechanicCounts,
    appointments: appointmentCounts,
    slots: slotCounts,
    appointmentsByDay,
    topMechanics,
  };
}

export function adminRoutes(app: FastifyInstance, db: Db) {
  app.get('/admin/dashboard', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { from, to } = parseAdminFilters(request.query);
    const today = getSaoPauloDateTimeParts().date;

    return getAdminDashboard(db, from, to, today);
  });

  app.post('/admin/mechanics', { preHandler: requireAdmin(db) }, async (request, reply) => {
    const parsed = CreateMechanicSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    const { name, phone, email, password, specialty, credentials } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    try {
      const created = runImmediateTransaction<AdminMechanicResponse>(db, (tx) => {
        const profile = tx
          .insert(profiles)
          .values({ id, name, email: normalizedEmail, role: 'mechanic', phone, passwordHash })
          .returning({
            id: profiles.id,
            name: profiles.name,
            email: profiles.email,
            phone: profiles.phone,
            avatarUrl: profiles.avatarUrl,
            createdAt: profiles.createdAt,
          })
          .get();

        const mechanic = tx
          .insert(mechanics)
          .values({ id, specialty, credentials, isActive: true })
          .returning({
            specialty: mechanics.specialty,
            credentials: mechanics.credentials,
            isActive: mechanics.isActive,
          })
          .get();

        return { ...profile, ...mechanic };
      });

      return reply.code(201).send(created);
    } catch (error) {
      if (isProfilesEmailUniqueConstraintError(error)) {
        throw new HttpError(409, 'email already registered', 'EMAIL_TAKEN');
      }
      throw error;
    }
  });
}
