import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  appointmentViewColumnsFor,
  serializeAppointment,
  type AppointmentViewRow,
  type ServiceItem,
} from '../appointments/serializer.js';
import { syncUnfinalized } from '../appointments/sync-unfinalized.js';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import {
  appointmentServiceReports,
  appointmentServiceItems,
  appointments,
  mechanics,
  notifications,
  profiles,
  timeslots,
} from '../db/schema.js';
import { HttpError } from '../errors.js';
import { getSaoPauloDateTimeParts } from '../lib/sao-paulo-time.js';

const NullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .optional()
    .transform((value) => value ?? null);

const BookAppointmentSchema = z
  .object({
    timeslotId: z.string().trim().min(1),
    vehicleInfo: NullableTrimmedString(120),
    notes: NullableTrimmedString(1000),
  })
  .strict();

const CompleteAppointmentSchema = z
  .object({
    summary: z.string().trim().min(3).max(240),
    diagnosis: NullableTrimmedString(1000),
    workPerformed: z.string().trim().min(3).max(2000),
    partsUsed: NullableTrimmedString(1000),
    recommendations: NullableTrimmedString(1000),
    items: z
      .array(
        z
          .object({
            description: z.string().trim().min(2).max(160),
            amountCents: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

const appointmentNotFound = () => new HttpError(404, 'appointment not found', 'APPOINTMENT_NOT_FOUND');

function notificationBody(action: 'confirmado' | 'cancelado', mechanicName: string, date: string, startTime: string) {
  const [, month, day] = date.split('-');
  return `Seu agendamento com ${mechanicName} em ${day}/${month} às ${startTime.slice(0, 5)} foi ${action}.`;
}

function completionNotificationBody(mechanicName: string, date: string, startTime: string) {
  const [, month, day] = date.split('-');
  return `Seu atendimento com ${mechanicName} em ${day}/${month} às ${startTime.slice(0, 5)} foi finalizado.`;
}

function mechanicNotificationBody(action: 'agendou' | 'cancelou', clientName: string, date: string, startTime: string) {
  const [, month, day] = date.split('-');
  const dateTime = `${day}/${month} às ${startTime.slice(0, 5)}`;
  return action === 'agendou'
    ? `${clientName} agendou com você em ${dateTime}.`
    : `${clientName} cancelou o agendamento de ${dateTime}.`;
}

function loadServiceItems(db: Db, appointmentIds: string[]) {
  const grouped = new Map<string, ServiceItem[]>();
  if (appointmentIds.length === 0) {
    return grouped;
  }

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
    .orderBy(asc(appointmentServiceItems.sortOrder))
    .all();

  for (const { appointmentId, ...item } of rows) {
    const items = grouped.get(appointmentId) ?? [];
    items.push(item);
    grouped.set(appointmentId, items);
  }

  return grouped;
}

export function appointmentRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.get('/appointments', { preHandler: authenticate }, async (request) => {
    syncUnfinalized(db);

    const caller = db
      .select({ role: profiles.role, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, request.user!.sub))
      .get();
    if (caller?.role !== 'client' && caller?.role !== 'mechanic') {
      throw new HttpError(501, 'not implemented', 'NOT_IMPLEMENTED');
    }

    const viewer = caller.role;

    const rows = db
      .select(appointmentViewColumnsFor(viewer))
      .from(appointments)
      .innerJoin(
        profiles,
        eq(profiles.id, viewer === 'client' ? appointments.mechanicId : appointments.clientId),
      )
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(eq(viewer === 'client' ? appointments.clientId : appointments.mechanicId, request.user!.sub))
      .orderBy(desc(appointments.date), desc(appointments.startTime))
      .all();

    const scopedRows: AppointmentViewRow[] = rows.map((row) =>
      viewer === 'client' ? { ...row, clientName: caller.name } : { ...row, mechanicName: caller.name },
    );
    const itemsByAppointment = loadServiceItems(db, scopedRows.map((row) => row.id));

    return scopedRows.map((row) => serializeAppointment(row, viewer, itemsByAppointment.get(row.id) ?? []));
  });

  app.get<{ Params: { id: string } }>('/appointments/:id', { preHandler: authenticate }, async (request) => {
    syncUnfinalized(db);

    const caller = db
      .select({ role: profiles.role, name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, request.user!.sub))
      .get();
    if (caller?.role !== 'client' && caller?.role !== 'mechanic') {
      throw appointmentNotFound();
    }

    const viewer = caller.role;

    const row = db
      .select(appointmentViewColumnsFor(viewer))
      .from(appointments)
      .innerJoin(
        profiles,
        eq(profiles.id, viewer === 'client' ? appointments.mechanicId : appointments.clientId),
      )
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(
        and(
          eq(appointments.id, request.params.id),
          eq(viewer === 'client' ? appointments.clientId : appointments.mechanicId, request.user!.sub),
        ),
      )
      .get();

    if (!row) {
      throw appointmentNotFound();
    }

    const scopedRow: AppointmentViewRow =
      viewer === 'client' ? { ...row, clientName: caller.name } : { ...row, mechanicName: caller.name };
    const items = loadServiceItems(db, [scopedRow.id]).get(scopedRow.id) ?? [];

    return serializeAppointment(scopedRow, viewer, items);
  });

  app.post(
    '/appointments',
    { preHandler: [authenticate, requireRole(db, 'client')] },
    async (request, reply) => {
      const parsed = BookAppointmentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
      }

      const appointment = runImmediateTransaction<AppointmentViewRow>(
        db,
        (tx) => {
          const slot = tx
            .select({
              id: timeslots.id,
              mechanicId: timeslots.mechanicId,
              date: timeslots.date,
              startTime: timeslots.startTime,
              endTime: timeslots.endTime,
              isAvailable: timeslots.isAvailable,
              mechanicActive: mechanics.isActive,
              mechanicName: profiles.name,
              mechanicPhone: profiles.phone,
            })
            .from(timeslots)
            .innerJoin(mechanics, eq(mechanics.id, timeslots.mechanicId))
            .innerJoin(profiles, eq(profiles.id, timeslots.mechanicId))
            .where(eq(timeslots.id, parsed.data.timeslotId))
            .get();

          if (!slot) {
            throw new HttpError(404, 'timeslot not found', 'TIMESLOT_NOT_FOUND');
          }
          if (!slot.mechanicActive) {
            throw new HttpError(409, 'mechanic unavailable', 'MECHANIC_UNAVAILABLE');
          }
          if (!slot.isAvailable) {
            throw new HttpError(409, 'timeslot unavailable', 'TIMESLOT_UNAVAILABLE');
          }

          const now = getSaoPauloDateTimeParts();
          if (slot.date < now.date || (slot.date === now.date && slot.startTime <= now.time)) {
            throw new HttpError(409, 'timeslot expired', 'TIMESLOT_EXPIRED');
          }

          const client = tx
            .select({ name: profiles.name })
            .from(profiles)
            .where(eq(profiles.id, request.user!.sub))
            .get()!;

          const inserted = tx
            .insert(appointments)
            .values({
              id: randomUUID(),
              clientId: request.user!.sub,
              mechanicId: slot.mechanicId,
              timeslotId: slot.id,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              status: 'confirmado',
              vehicleInfo: parsed.data.vehicleInfo,
              notes: parsed.data.notes,
            })
            .returning()
            .get();

          tx.update(timeslots).set({ isAvailable: false }).where(eq(timeslots.id, slot.id)).run();
          tx.insert(notifications)
            .values({
              id: randomUUID(),
              recipientId: request.user!.sub,
              appointmentId: inserted.id,
              type: 'appointment_confirmed',
              title: 'Agendamento confirmado',
              body: notificationBody('confirmado', slot.mechanicName, inserted.date, inserted.startTime),
            })
            .run();
          tx.insert(notifications)
            .values({
              id: randomUUID(),
              recipientId: slot.mechanicId,
              appointmentId: inserted.id,
              type: 'appointment_confirmed',
              title: 'Novo agendamento',
              body: mechanicNotificationBody('agendou', client.name, inserted.date, inserted.startTime),
            })
            .run();

          return {
            ...inserted,
            mechanicName: slot.mechanicName,
            mechanicPhone: slot.mechanicPhone,
            clientName: client.name,
            clientPhone: null,
            serviceSummary: null,
            serviceDiagnosis: null,
            workPerformed: null,
            partsUsed: null,
            recommendations: null,
            totalAmountCents: null,
            closedAt: null,
          };
        },
        { appointmentsTimeslotUnique: true },
      );

      const items = loadServiceItems(db, [appointment.id]).get(appointment.id) ?? [];
      return reply.code(201).send(serializeAppointment(appointment, 'client', items));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/cancel',
    { preHandler: authenticate },
    async (request) => {
      syncUnfinalized(db);

      const result = runImmediateTransaction<{
        appointment: AppointmentViewRow;
        viewer: 'client' | 'mechanic';
      }>(db, (tx) => {
        const caller = tx
          .select({ role: profiles.role, name: profiles.name })
          .from(profiles)
          .where(eq(profiles.id, request.user!.sub))
          .get();
        if (caller?.role !== 'client' && caller?.role !== 'mechanic') {
          throw appointmentNotFound();
        }

        const viewer = caller.role;

        const row = tx
          .select(appointmentViewColumnsFor(viewer))
          .from(appointments)
          .innerJoin(
            profiles,
            eq(profiles.id, viewer === 'client' ? appointments.mechanicId : appointments.clientId),
          )
          .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
          .where(
            and(
              eq(appointments.id, request.params.id),
              eq(viewer === 'client' ? appointments.clientId : appointments.mechanicId, request.user!.sub),
            ),
          )
          .get();

        if (!row) {
          throw appointmentNotFound();
        }

        const scopedRow: AppointmentViewRow =
          viewer === 'client' ? { ...row, clientName: caller.name } : { ...row, mechanicName: caller.name };

        if (row.status === 'cancelado') {
          return { appointment: scopedRow, viewer };
        }
        const canCancel = row.status === 'confirmado' || (viewer === 'mechanic' && row.status === 'nao_finalizado');
        if (!canCancel) {
          throw new HttpError(
            409,
            `cannot cancel appointment with status ${row.status}`,
            'APPOINTMENT_NOT_CANCELLABLE',
          );
        }

        tx.update(appointments).set({ status: 'cancelado' }).where(eq(appointments.id, row.id)).run();
        if (row.timeslotId !== null) {
          tx.update(timeslots).set({ isAvailable: true }).where(eq(timeslots.id, row.timeslotId)).run();
        }
        tx.insert(notifications)
          .values({
            id: randomUUID(),
            recipientId: row.clientId,
            appointmentId: row.id,
            type: 'appointment_canceled',
            title: 'Agendamento cancelado',
            body: notificationBody('cancelado', scopedRow.mechanicName, row.date, row.startTime),
          })
          .run();
        if (viewer === 'client') {
          tx.insert(notifications)
            .values({
              id: randomUUID(),
              recipientId: row.mechanicId,
              appointmentId: row.id,
              type: 'appointment_canceled',
              title: 'Agendamento cancelado',
              body: mechanicNotificationBody('cancelou', scopedRow.clientName, row.date, row.startTime),
            })
            .run();
        }

        return { appointment: { ...scopedRow, status: 'cancelado' }, viewer };
      });

      const items = loadServiceItems(db, [result.appointment.id]).get(result.appointment.id) ?? [];
      return serializeAppointment(result.appointment, result.viewer, items);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/complete',
    { preHandler: authenticate },
    async (request) => {
      const parsed = CompleteAppointmentSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
      }

      const appointment = runImmediateTransaction<AppointmentViewRow>(
        db,
        (tx) => {
          const caller = tx
            .select({ role: profiles.role, name: profiles.name })
            .from(profiles)
            .where(eq(profiles.id, request.user!.sub))
            .get();
          if (caller?.role !== 'mechanic') {
            throw appointmentNotFound();
          }

          const row = tx
            .select(appointmentViewColumnsFor('mechanic'))
            .from(appointments)
            .innerJoin(profiles, eq(profiles.id, appointments.clientId))
            .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
            .where(and(eq(appointments.id, request.params.id), eq(appointments.mechanicId, request.user!.sub)))
            .get();
          if (!row) {
            throw appointmentNotFound();
          }

          switch (row.status) {
            case 'confirmado':
            case 'nao_finalizado':
              break;
            case 'acabado':
              throw new HttpError(409, 'appointment already completed', 'APPOINTMENT_ALREADY_COMPLETED');
            case 'cancelado':
              throw new HttpError(
                409,
                'cannot complete appointment with status cancelado',
                'APPOINTMENT_NOT_COMPLETABLE',
              );
          }

          const totalAmountCents = parsed.data.items.reduce((total, item) => total + item.amountCents, 0);
          const report = tx
            .insert(appointmentServiceReports)
            .values({
              appointmentId: row.id,
              mechanicId: request.user!.sub,
              summary: parsed.data.summary,
              diagnosis: parsed.data.diagnosis,
              workPerformed: parsed.data.workPerformed,
              partsUsed: parsed.data.partsUsed,
              recommendations: parsed.data.recommendations,
              totalAmountCents,
            })
            .returning()
            .get();

          tx.insert(appointmentServiceItems)
            .values(
              parsed.data.items.map((item, sortOrder) => ({
                id: randomUUID(),
                appointmentId: row.id,
                description: item.description,
                amountCents: item.amountCents,
                sortOrder,
              })),
            )
            .run();
          tx.update(appointments).set({ status: 'acabado' }).where(eq(appointments.id, row.id)).run();
          tx.insert(notifications)
            .values({
              id: randomUUID(),
              recipientId: row.clientId,
              appointmentId: row.id,
              type: 'appointment_completed',
              title: 'Atendimento finalizado',
              body: completionNotificationBody(caller.name, row.date, row.startTime),
            })
            .run();

          return {
            ...row,
            status: 'acabado',
            mechanicName: caller.name,
            serviceSummary: report.summary,
            serviceDiagnosis: report.diagnosis,
            workPerformed: report.workPerformed,
            partsUsed: report.partsUsed,
            recommendations: report.recommendations,
            totalAmountCents: report.totalAmountCents,
            closedAt: report.closedAt,
          };
        },
        { appointmentServiceReportsPrimaryKey: true },
      );

      const items = loadServiceItems(db, [appointment.id]).get(appointment.id) ?? [];
      return serializeAppointment(appointment, 'mechanic', items);
    },
  );
}
