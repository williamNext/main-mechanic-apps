import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseAdminFilters } from '../admin/filters.js';
import { requireAdmin } from '../admin/guard.js';
import { pagination, totalOrder } from '../admin/query-helpers.js';
import { syncUnfinalized } from '../appointments/sync-unfinalized.js';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { hashPassword } from '../auth/hash.js';
import type { Db } from '../db/client.js';
import {
  appointmentServiceItems,
  appointmentServiceReports,
  appointments,
  adminActionLog,
  mechanics,
  notifications,
  profiles,
  timeslots,
} from '../db/schema.js';
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

const DeactivateMechanicsSchema = z
  .object({
    mechanicIds: z.array(z.string().trim().min(1)),
  })
  .strict();

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

function adminCancellationBody(mechanicName: string, date: string, startTime: string): string {
  const [, month, day] = date.split('-');
  return `Seu agendamento com ${mechanicName} em ${day}/${month} às ${startTime.slice(0, 5)} foi cancelado porque o mecânico não está mais disponível.`;
}

function countWhere(predicate: SQL): SQL<number> {
  return sql<number>`coalesce(sum(case when ${predicate} then 1 else 0 end), 0)`.mapWith(Number);
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function mechanicSearch(search: string): SQL | undefined {
  if (!search) return undefined;
  const pattern = `%${escapeLikePattern(search)}%`;
  return sql`(lower(${profiles.name}) LIKE lower(${pattern}) ESCAPE '\\' OR lower(${profiles.email}) LIKE lower(${pattern}) ESCAPE '\\')`;
}

const adminMechanicColumns = {
  id: mechanics.id,
  name: profiles.name,
  email: profiles.email,
  phone: profiles.phone,
  avatarUrl: profiles.avatarUrl,
  createdAt: profiles.createdAt,
  specialty: mechanics.specialty,
  credentials: mechanics.credentials,
  isActive: mechanics.isActive,
  appointmentsTotal: sql<number>`(
    select count(*) from ${appointments} where ${appointments.mechanicId} = ${mechanics.id}
  )`.mapWith(Number),
  appointmentsConfirmed: sql<number>`(
    select count(*) from ${appointments}
    where ${appointments.mechanicId} = ${mechanics.id} and ${appointments.status} = 'confirmado'
  )`.mapWith(Number),
  lastAppointmentDate: sql<string | null>`(
    select max(${appointments.date}) from ${appointments} where ${appointments.mechanicId} = ${mechanics.id}
  )`,
};

function getAdminMechanicRows(db: Db, search?: SQL) {
  return db
    .select(adminMechanicColumns)
    .from(mechanics)
    .innerJoin(profiles, eq(profiles.id, mechanics.id))
    .where(search);
}

const adminAppointmentColumns = {
  id: appointments.id,
  clientId: appointments.clientId,
  clientName: sql<string | null>`(select name from ${profiles} where ${profiles.id} = ${appointments.clientId})`,
  clientPhone: sql<string | null>`(select phone from ${profiles} where ${profiles.id} = ${appointments.clientId})`,
  mechanicId: appointments.mechanicId,
  mechanicName: sql<string | null>`(select name from ${profiles} where ${profiles.id} = ${appointments.mechanicId})`,
  mechanicPhone: sql<string | null>`(select phone from ${profiles} where ${profiles.id} = ${appointments.mechanicId})`,
  specialty: sql<string | null>`(select specialty from ${mechanics} where ${mechanics.id} = ${appointments.mechanicId})`,
  timeSlotId: appointments.timeSlotId,
  date: appointments.date,
  startTime: appointments.startTime,
  endTime: appointments.endTime,
  status: appointments.status,
  vehicleInfo: appointments.vehicleInfo,
  notes: appointments.notes,
  serviceSummary: appointmentServiceReports.summary,
  serviceDiagnosis: appointmentServiceReports.diagnosis,
  workPerformed: appointmentServiceReports.workPerformed,
  partsUsed: appointmentServiceReports.partsUsed,
  recommendations: appointmentServiceReports.recommendations,
  totalAmountCents: appointmentServiceReports.totalAmountCents,
  closedAt: appointmentServiceReports.closedAt,
  createdAt: appointments.createdAt,
};

function appointmentSearch(search: string): SQL | undefined {
  if (!search) return undefined;
  const pattern = `%${escapeLikePattern(search)}%`;
  return sql`(
    lower(coalesce((select name from ${profiles} where ${profiles.id} = ${appointments.clientId}), '')) LIKE lower(${pattern}) ESCAPE '\\'
    OR lower(coalesce((select name from ${profiles} where ${profiles.id} = ${appointments.mechanicId}), '')) LIKE lower(${pattern}) ESCAPE '\\'
    OR lower(coalesce((select phone from ${profiles} where ${profiles.id} = ${appointments.clientId}), '')) LIKE lower(${pattern}) ESCAPE '\\'
    OR lower(coalesce((select phone from ${profiles} where ${profiles.id} = ${appointments.mechanicId}), '')) LIKE lower(${pattern}) ESCAPE '\\'
    OR lower(coalesce(${appointments.vehicleInfo}, '')) LIKE lower(${pattern}) ESCAPE '\\'
    OR lower(coalesce(${appointmentServiceReports.summary}, '')) LIKE lower(${pattern}) ESCAPE '\\'
  )`;
}

function getAdminAppointmentRows(db: Db, predicate?: SQL) {
  return db
    .select(adminAppointmentColumns)
    .from(appointments)
    .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate);
}

function loadAdminServiceItems(db: Db, appointmentIds: string[]) {
  const grouped = new Map<string, Array<{ id: string; description: string; amountCents: number; sortOrder: number }>>();
  if (appointmentIds.length === 0) return grouped;

  const rows = db
    .select({
      appointmentId: appointmentServiceItems.appointmentId,
      id: appointmentServiceItems.id,
      description: appointmentServiceItems.description,
      amountCents: appointmentServiceItems.amountCents,
      sortOrder: appointmentServiceItems.sortOrder,
    })
    .from(appointmentServiceItems)
    .where(inArray(appointmentServiceItems.appointmentId, appointmentIds))
    .orderBy(asc(appointmentServiceItems.sortOrder), asc(appointmentServiceItems.id))
    .all();

  for (const { appointmentId, ...item } of rows) {
    const items = grouped.get(appointmentId) ?? [];
    items.push(item);
    grouped.set(appointmentId, items);
  }

  return grouped;
}

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function nextMonth(month: string): string {
  const next = new Date(`${month}-01T00:00:00.000Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString().slice(0, 7);
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

function getAdminFinancialReport(db: Db, from: string, to: string, mechanicId: string | null | undefined, search: string) {
  const predicate = and(
    gte(appointments.date, from),
    sql`${appointments.date} <= ${to}`,
    eq(appointments.status, 'acabado'),
    mechanicId ? eq(appointments.mechanicId, mechanicId) : undefined,
    appointmentSearch(search),
  );
  const revenue = sql<number>`coalesce(sum(${appointmentServiceReports.totalAmountCents}), 0)`.mapWith(Number);
  const summaryRow = db
    .select({ appointments: count(appointments.id), revenueCents: revenue })
    .from(appointments)
    .innerJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate)
    .get()!;
  const dailyRows = db
    .select({ date: appointments.date, appointments: count(appointments.id), revenueCents: revenue })
    .from(appointments)
    .innerJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate)
    .groupBy(appointments.date)
    .orderBy(asc(appointments.date))
    .all();
  const month = sql<string>`substr(${appointments.date}, 1, 7)`;
  const monthlyRows = db
    .select({ month, appointments: count(appointments.id), revenueCents: revenue })
    .from(appointments)
    .innerJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate)
    .groupBy(month)
    .orderBy(asc(month))
    .all();
  const mechanicName = sql<string>`(select name from ${profiles} where ${profiles.id} = ${appointments.mechanicId})`;
  const specialty = sql<string>`(select specialty from ${mechanics} where ${mechanics.id} = ${appointments.mechanicId})`;
  const byMechanic = db
    .select({
      mechanicId: appointments.mechanicId,
      mechanicName,
      specialty,
      appointments: count(appointments.id),
      revenueCents: revenue,
    })
    .from(appointments)
    .innerJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate)
    .groupBy(appointments.mechanicId)
    .orderBy(desc(revenue), asc(mechanicName), asc(appointments.mechanicId))
    .all();
  const serviceRevenue = sql<number>`coalesce(sum(${appointmentServiceReports.totalAmountCents}), 0)`.mapWith(Number);
  const byService = db
    .select({
      description: appointmentServiceItems.description,
      quantity: count(appointmentServiceItems.id),
      revenueCents: serviceRevenue,
    })
    .from(appointmentServiceItems)
    .innerJoin(
      appointmentServiceReports,
      eq(appointmentServiceReports.appointmentId, appointmentServiceItems.appointmentId),
    )
    .innerJoin(appointments, eq(appointments.id, appointmentServiceReports.appointmentId))
    .where(predicate)
    .groupBy(appointmentServiceItems.description)
    .orderBy(desc(serviceRevenue), asc(appointmentServiceItems.description))
    .all();
  const reportAppointments = db
    .select({
      id: appointments.id,
      date: appointments.date,
      clientName: sql<string | null>`(select name from ${profiles} where ${profiles.id} = ${appointments.clientId})`,
      mechanicName,
      vehicleInfo: appointments.vehicleInfo,
      serviceSummary: appointmentServiceReports.summary,
      totalAmountCents: appointmentServiceReports.totalAmountCents,
      closedAt: appointmentServiceReports.closedAt,
    })
    .from(appointments)
    .innerJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
    .where(predicate)
    .orderBy(desc(appointments.date), desc(appointmentServiceReports.closedAt), desc(appointments.id))
    .all();

  const dailyByDate = new Map(dailyRows.map((row) => [row.date, row]));
  const revenueByDay = [];
  for (let date = from; date <= to; date = nextDate(date)) {
    revenueByDay.push(dailyByDate.get(date) ?? { date, appointments: 0, revenueCents: 0 });
  }

  const monthlyByMonth = new Map(monthlyRows.map((row) => [row.month, row]));
  const revenueByMonth = [];
  for (let currentMonth = from.slice(0, 7); currentMonth <= to.slice(0, 7); currentMonth = nextMonth(currentMonth)) {
    revenueByMonth.push(monthlyByMonth.get(currentMonth) ?? { month: currentMonth, appointments: 0, revenueCents: 0 });
  }

  return {
    range: { from, to },
    generatedAt: new Date().toISOString(),
    summary: {
      ...summaryRow,
      averageTicketCents:
        summaryRow.appointments === 0 ? 0 : Math.trunc(summaryRow.revenueCents / summaryRow.appointments),
    },
    revenueByDay,
    revenueByMonth,
    byMechanic,
    byService,
    appointments: reportAppointments,
  };
}

export function adminRoutes(app: FastifyInstance, db: Db) {
  app.get('/admin/dashboard', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { from, to } = parseAdminFilters(request.query);
    const today = getSaoPauloDateTimeParts().date;

    return getAdminDashboard(db, from, to, today);
  });

  app.get('/admin/mechanics', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { search, page, pageSize } = parseAdminFilters(request.query);
    const searchPredicate = mechanicSearch(search);
    const pageBounds = pagination(page, pageSize);
    const total = db
      .select({ value: count(mechanics.id) })
      .from(mechanics)
      .innerJoin(profiles, eq(profiles.id, mechanics.id))
      .where(searchPredicate)
      .get()!.value;
    const rows = getAdminMechanicRows(db, searchPredicate)
      .orderBy(...totalOrder([asc(profiles.name)], mechanics.id))
      .limit(pageBounds.limit)
      .offset(pageBounds.offset)
      .all();

    return { rows, total, page, pageSize };
  });

  app.get('/admin/appointments', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { from, to, status, mechanicId, search, page, pageSize } = parseAdminFilters(request.query);
    const predicate = and(
      gte(appointments.date, from),
      sql`${appointments.date} <= ${to}`,
      status === 'all' ? undefined : eq(appointments.status, status),
      mechanicId ? eq(appointments.mechanicId, mechanicId) : undefined,
      appointmentSearch(search),
    );
    const pageBounds = pagination(page, pageSize);
    const total = db
      .select({ value: count(appointments.id) })
      .from(appointments)
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(predicate)
      .get()!.value;
    const pageRows = getAdminAppointmentRows(db, predicate)
      .orderBy(...totalOrder([desc(appointments.date), desc(appointments.startTime)], appointments.id, 'desc'))
      .limit(pageBounds.limit)
      .offset(pageBounds.offset)
      .all();
    const itemsByAppointment = loadAdminServiceItems(
      db,
      pageRows.map((appointment) => appointment.id),
    );
    const rows = pageRows.map((appointment) => ({
      ...appointment,
      serviceItems: itemsByAppointment.get(appointment.id) ?? [],
    }));

    return { rows, total, page, pageSize };
  });

  app.get('/admin/finance', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { from, to, mechanicId, search } = parseAdminFilters(request.query);

    return getAdminFinancialReport(db, from, to, mechanicId, search);
  });

  app.get<{ Params: { id: string } }>('/admin/mechanics/:id', { preHandler: requireAdmin(db) }, async (request) => {
    syncUnfinalized(db);
    const { from, to } = parseAdminFilters(request.query);
    const mechanic = getAdminMechanicRows(db, eq(mechanics.id, request.params.id)).get();
    if (!mechanic) {
      throw new HttpError(404, 'mechanic not found', 'MECHANIC_NOT_FOUND');
    }

    const appointmentStats = db
      .select({
        total: count(appointments.id),
        confirmed: countWhere(eq(appointments.status, 'confirmado')),
        unfinished: countWhere(eq(appointments.status, 'nao_finalizado')),
        finished: countWhere(eq(appointments.status, 'acabado')),
        canceled: countWhere(eq(appointments.status, 'cancelado')),
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.mechanicId, mechanic.id),
          gte(appointments.date, from),
          sql`${appointments.date} <= ${to}`,
        ),
      )
      .get()!;
    const today = getSaoPauloDateTimeParts().date;
    const slotStats = db
      .select({
        totalUpcoming: count(timeslots.id),
        availableUpcoming: countWhere(eq(timeslots.isAvailable, true)),
      })
      .from(timeslots)
      .where(and(eq(timeslots.mechanicId, mechanic.id), gte(timeslots.date, today)))
      .get()!;
    const recentRows = db
      .select({
        id: appointments.id,
        clientId: appointments.clientId,
        clientName: sql<string | null>`(select name from ${profiles} where ${profiles.id} = ${appointments.clientId})`,
        clientPhone: sql<string | null>`(select phone from ${profiles} where ${profiles.id} = ${appointments.clientId})`,
        mechanicId: appointments.mechanicId,
        timeSlotId: appointments.timeSlotId,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        vehicleInfo: appointments.vehicleInfo,
        notes: appointments.notes,
        serviceSummary: appointmentServiceReports.summary,
        serviceDiagnosis: appointmentServiceReports.diagnosis,
        workPerformed: appointmentServiceReports.workPerformed,
        partsUsed: appointmentServiceReports.partsUsed,
        recommendations: appointmentServiceReports.recommendations,
        totalAmountCents: appointmentServiceReports.totalAmountCents,
        closedAt: appointmentServiceReports.closedAt,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.mechanicId, mechanic.id),
          gte(appointments.date, from),
          sql`${appointments.date} <= ${to}`,
        ),
      )
      .orderBy(...totalOrder([desc(appointments.date), desc(appointments.startTime)], appointments.id, 'desc'))
      .limit(20)
      .all();
    const itemsByAppointment = loadAdminServiceItems(
      db,
      recentRows.map((appointment) => appointment.id),
    );
    const recentAppointments = recentRows.map((appointment) => ({
      ...appointment,
      mechanicName: mechanic.name,
      mechanicPhone: mechanic.phone,
      specialty: mechanic.specialty,
      serviceItems: itemsByAppointment.get(appointment.id) ?? [],
    }));

    return {
      mechanic,
      range: { from, to },
      appointmentStats,
      slotStats,
      recentAppointments,
    };
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

  app.post('/admin/mechanics/deactivate', { preHandler: requireAdmin(db) }, async (request) => {
    const parsed = DeactivateMechanicsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    const mechanicIds = [...new Set(parsed.data.mechanicIds)];
    if (mechanicIds.length === 0 || mechanicIds.length > 100) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    return runImmediateTransaction(db, (tx) => {
      const resolvedMechanics = tx
        .select({
          id: mechanics.id,
          name: profiles.name,
          email: profiles.email,
          phone: profiles.phone,
          specialty: mechanics.specialty,
          credentials: mechanics.credentials,
          isActive: mechanics.isActive,
        })
        .from(mechanics)
        .innerJoin(profiles, eq(profiles.id, mechanics.id))
        .where(inArray(mechanics.id, mechanicIds))
        .all();

      if (resolvedMechanics.length === 0) {
        throw new HttpError(404, 'no matching mechanics found', 'NO_MATCHING_MECHANICS');
      }

      const activeMechanics = resolvedMechanics.filter((mechanic) => mechanic.isActive);
      const activeMechanicIds = activeMechanics.map((mechanic) => mechanic.id);
      const cancellableAppointments =
        activeMechanicIds.length === 0
          ? []
          : tx
              .select({
                id: appointments.id,
                clientId: appointments.clientId,
                mechanicId: appointments.mechanicId,
                timeSlotId: appointments.timeSlotId,
                date: appointments.date,
                startTime: appointments.startTime,
              })
              .from(appointments)
              .where(
                and(
                  inArray(appointments.mechanicId, activeMechanicIds),
                  inArray(appointments.status, ['confirmado', 'nao_finalizado']),
                ),
              )
              .orderBy(asc(appointments.id))
              .all();

      if (cancellableAppointments.length > 0) {
        const appointmentIds = cancellableAppointments.map((appointment) => appointment.id);
        const timeSlotIds = cancellableAppointments.flatMap((appointment) =>
          appointment.timeSlotId === null ? [] : [appointment.timeSlotId],
        );

        tx.update(appointments)
          .set({ status: 'cancelado' })
          .where(inArray(appointments.id, appointmentIds))
          .run();
        if (timeSlotIds.length > 0) {
          tx.update(timeslots).set({ isAvailable: true }).where(inArray(timeslots.id, timeSlotIds)).run();
        }

        const mechanicNames = new Map(activeMechanics.map((mechanic) => [mechanic.id, mechanic.name]));
        tx.insert(notifications)
          .values(
            cancellableAppointments.map((appointment) => ({
              id: randomUUID(),
              recipientId: appointment.clientId,
              appointmentId: appointment.id,
              type: 'appointment_canceled',
              title: 'Agendamento cancelado',
              body: adminCancellationBody(
                mechanicNames.get(appointment.mechanicId)!,
                appointment.date,
                appointment.startTime,
              ),
            })),
          )
          .run();
      }

      if (activeMechanics.length > 0) {
        const cancelledByMechanic = new Map<string, string[]>();
        for (const appointment of cancellableAppointments) {
          const ids = cancelledByMechanic.get(appointment.mechanicId) ?? [];
          ids.push(appointment.id);
          cancelledByMechanic.set(appointment.mechanicId, ids);
        }

        tx.insert(adminActionLog)
          .values(
            activeMechanics.map((mechanic) => {
              const cancelledAppointmentIds = cancelledByMechanic.get(mechanic.id) ?? [];
              return {
                id: randomUUID(),
                actorId: request.user!.sub,
                targetMechanicId: mechanic.id,
                action: 'deactivate_mechanic' as const,
                beforeState: JSON.stringify({
                  ...mechanic,
                  cancelledAppointmentIds,
                  cancelledAppointmentCount: cancelledAppointmentIds.length,
                }),
                afterState: JSON.stringify({ isActive: false }),
              };
            }),
          )
          .run();
        tx.update(mechanics).set({ isActive: false }).where(inArray(mechanics.id, activeMechanicIds)).run();
      }

      return {
        deactivatedCount: activeMechanics.length,
        requestedCount: mechanicIds.length,
        ignoredCount: mechanicIds.length - activeMechanics.length,
        cancelledAppointmentCount: cancellableAppointments.length,
      };
    });
  });

  app.post<{ Params: { id: string } }>(
    '/admin/mechanics/:id/reactivate',
    { preHandler: requireAdmin(db) },
    async (request) =>
      runImmediateTransaction(db, (tx) => {
        const mechanic = tx
          .select({
            id: mechanics.id,
            name: profiles.name,
            email: profiles.email,
            phone: profiles.phone,
            avatarUrl: profiles.avatarUrl,
            createdAt: profiles.createdAt,
            specialty: mechanics.specialty,
            credentials: mechanics.credentials,
            isActive: mechanics.isActive,
          })
          .from(mechanics)
          .innerJoin(profiles, eq(profiles.id, mechanics.id))
          .where(eq(mechanics.id, request.params.id))
          .get();

        if (!mechanic) {
          throw new HttpError(404, 'mechanic not found', 'MECHANIC_NOT_FOUND');
        }
        if (mechanic.isActive) {
          return mechanic;
        }

        tx.insert(adminActionLog)
          .values({
            id: randomUUID(),
            actorId: request.user!.sub,
            targetMechanicId: mechanic.id,
            action: 'reactivate_mechanic',
            beforeState: JSON.stringify({
              id: mechanic.id,
              name: mechanic.name,
              email: mechanic.email,
              phone: mechanic.phone,
              specialty: mechanic.specialty,
              credentials: mechanic.credentials,
              isActive: mechanic.isActive,
            }),
            afterState: JSON.stringify({ isActive: true }),
          })
          .run();
        tx.update(mechanics).set({ isActive: true }).where(eq(mechanics.id, mechanic.id)).run();

        return { ...mechanic, isActive: true };
      }),
  );
}
