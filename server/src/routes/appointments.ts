import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { appointmentViewColumns, serializeAppointment, type AppointmentViewRow } from '../appointments/serializer.js';
import { syncUnfinalized } from '../appointments/sync-unfinalized.js';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import {
  appointmentServiceReports,
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

const appointmentNotFound = () => new HttpError(404, 'appointment not found', 'APPOINTMENT_NOT_FOUND');

function notificationBody(action: 'confirmado' | 'cancelado', mechanicName: string, date: string, startTime: string) {
  const [, month, day] = date.split('-');
  return `Seu agendamento com ${mechanicName} em ${day}/${month} às ${startTime.slice(0, 5)} foi ${action}.`;
}

export function appointmentRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.get('/appointments', { preHandler: authenticate }, async (request) => {
    syncUnfinalized(db);

    const caller = db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, request.user!.sub))
      .get();
    if (caller?.role !== 'client') {
      throw new HttpError(501, 'not implemented', 'NOT_IMPLEMENTED');
    }

    const rows = db
      .select(appointmentViewColumns)
      .from(appointments)
      .innerJoin(profiles, eq(profiles.id, appointments.mechanicId))
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(eq(appointments.clientId, request.user!.sub))
      .orderBy(desc(appointments.date), desc(appointments.startTime))
      .all();

    return rows.map(serializeAppointment);
  });

  app.get<{ Params: { id: string } }>('/appointments/:id', { preHandler: authenticate }, async (request) => {
    syncUnfinalized(db);

    const caller = db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, request.user!.sub))
      .get();
    if (caller?.role !== 'client') {
      throw appointmentNotFound();
    }

    const row = db
      .select(appointmentViewColumns)
      .from(appointments)
      .innerJoin(profiles, eq(profiles.id, appointments.mechanicId))
      .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
      .where(and(eq(appointments.id, request.params.id), eq(appointments.clientId, request.user!.sub)))
      .get();

    if (!row) {
      throw appointmentNotFound();
    }

    return serializeAppointment(row);
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

          return {
            ...inserted,
            mechanicName: slot.mechanicName,
            mechanicPhone: slot.mechanicPhone,
            serviceSummary: null,
            serviceDiagnosis: null,
            workPerformed: null,
            partsUsed: null,
            recommendations: null,
            totalAmountCents: null,
            closedAt: null,
          };
        },
        true,
      );

      return reply.code(201).send(serializeAppointment(appointment));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/appointments/:id/cancel',
    { preHandler: authenticate },
    async (request) => {
      syncUnfinalized(db);

      const appointment = runImmediateTransaction<AppointmentViewRow>(db, (tx) => {
        const caller = tx
          .select({ role: profiles.role })
          .from(profiles)
          .where(eq(profiles.id, request.user!.sub))
          .get();
        if (caller?.role !== 'client') {
          throw appointmentNotFound();
        }

        const row = tx
          .select(appointmentViewColumns)
          .from(appointments)
          .innerJoin(profiles, eq(profiles.id, appointments.mechanicId))
          .leftJoin(appointmentServiceReports, eq(appointmentServiceReports.appointmentId, appointments.id))
          .where(and(eq(appointments.id, request.params.id), eq(appointments.clientId, request.user!.sub)))
          .get();

        if (!row) {
          throw appointmentNotFound();
        }
        if (row.status === 'cancelado') {
          return row;
        }
        if (row.status !== 'confirmado') {
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
            body: notificationBody('cancelado', row.mechanicName, row.date, row.startTime),
          })
          .run();

        return { ...row, status: 'cancelado' };
      });

      return serializeAppointment(appointment);
    },
  );
}
