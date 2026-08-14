import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runImmediateTransaction } from '../appointments/transactions.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { appointments, mechanics, publicMechanics, timeslots } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { getSaoPauloDateTimeParts } from '../lib/sao-paulo-time.js';

const publicMechanicColumns = {
  id: publicMechanics.id,
  name: publicMechanics.name,
  specialty: publicMechanics.specialty,
  avatarUrl: publicMechanics.avatarUrl,
  updatedAt: publicMechanics.updatedAt,
};

const mechanicNotFound = () => new HttpError(404, 'mechanic not found', 'MECHANIC_NOT_FOUND');

const timeslotColumns = {
  id: timeslots.id,
  mechanicId: timeslots.mechanicId,
  date: timeslots.date,
  startTime: timeslots.startTime,
  endTime: timeslots.endTime,
  isAvailable: timeslots.isAvailable,
};

type TimeslotResponse = {
  id: string;
  mechanicId: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

const TimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

const CreateTimeslotSchema = z
  .object({
    date: z.string().refine(isDateString),
    startTime: TimeSchema,
    endTime: TimeSchema,
  })
  .strict()
  .refine((slot) => normalizeTime(slot.endTime) > normalizeTime(slot.startTime));

const CreateTimeslotsSchema = z.union([CreateTimeslotSchema, z.array(CreateTimeslotSchema).min(1)]);

const UpdateTimeslotSchema = z.object({ isAvailable: z.boolean() }).strict();

const timeslotNotFound = () => new HttpError(404, 'timeslot not found', 'TIMESLOT_NOT_FOUND');

function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function intervalsOverlap(
  first: { startTime: string; endTime: string },
  second: { startTime: string; endTime: string },
): boolean {
  return (
    normalizeTime(first.startTime) < normalizeTime(second.endTime) &&
    normalizeTime(second.startTime) < normalizeTime(first.endTime)
  );
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function isDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

export function mechanicsRoutes(app: FastifyInstance, db: Db) {
  const authenticate = requireAuth(db);

  app.post(
    '/timeslots',
    { preHandler: [authenticate, requireRole(db, 'mechanic')] },
    async (request, reply) => {
      const parsed = CreateTimeslotsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
      }

      const candidates = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
      if (new Set(candidates.map((slot) => slot.date)).size !== 1) {
        throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
      }

      const now = getSaoPauloDateTimeParts();
      if (
        candidates.some(
          (slot) => slot.date < now.date || (slot.date === now.date && slot.startTime <= now.time),
        )
      ) {
        throw new HttpError(409, 'timeslot expired', 'TIMESLOT_EXPIRED');
      }

      const inserted = runImmediateTransaction<TimeslotResponse[]>(
        db,
        (tx) => {
          const occupied = tx
            .select(timeslotColumns)
            .from(timeslots)
            .where(and(eq(timeslots.mechanicId, request.user!.sub), eq(timeslots.date, candidates[0].date)))
            .all();

          for (const candidate of candidates) {
            if (occupied.some((slot) => intervalsOverlap(candidate, slot))) {
              throw new HttpError(409, 'timeslot overlap', 'TIMESLOT_OVERLAP');
            }
            occupied.push({
              id: '',
              mechanicId: request.user!.sub,
              ...candidate,
              isAvailable: true,
            });
          }

          return tx
            .insert(timeslots)
            .values(
              candidates.map((slot) => ({
                id: randomUUID(),
                mechanicId: request.user!.sub,
                ...slot,
              })),
            )
            .returning(timeslotColumns)
            .all();
        },
        { timeslotIntervalUnique: true },
      );

      return reply.code(201).send(inserted);
    },
  );

  app.patch<{ Params: { id: string } }>('/timeslots/:id', { preHandler: authenticate }, async (request) => {
    const parsed = UpdateTimeslotSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid request body', 'VALIDATION_FAILED');
    }

    return runImmediateTransaction<TimeslotResponse>(db, (tx) => {
      const slot = tx
        .select({ id: timeslots.id })
        .from(timeslots)
        .where(and(eq(timeslots.id, request.params.id), eq(timeslots.mechanicId, request.user!.sub)))
        .get();
      if (!slot) {
        throw timeslotNotFound();
      }

      if (parsed.data.isAvailable) {
        const appointment = tx
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.timeslotId, slot.id),
              sql`${appointments.status} IN ('confirmado', 'nao_finalizado', 'acabado')`,
            ),
          )
          .get();
        if (appointment) {
          throw new HttpError(409, 'timeslot has appointment', 'TIMESLOT_HAS_APPOINTMENT');
        }
      }

      return tx
        .update(timeslots)
        .set({ isAvailable: parsed.data.isAvailable })
        .where(eq(timeslots.id, slot.id))
        .returning(timeslotColumns)
        .get();
    });
  });

  app.delete<{ Params: { id: string } }>('/timeslots/:id', { preHandler: authenticate }, async (request, reply) => {
    runImmediateTransaction<void>(db, (tx) => {
      const slot = tx
        .select({ id: timeslots.id })
        .from(timeslots)
        .where(and(eq(timeslots.id, request.params.id), eq(timeslots.mechanicId, request.user!.sub)))
        .get();
      if (!slot) {
        throw timeslotNotFound();
      }

      const appointment = tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.timeslotId, slot.id),
            sql`${appointments.status} IN ('confirmado', 'nao_finalizado')`,
          ),
        )
        .get();
      if (appointment) {
        throw new HttpError(409, 'timeslot has appointment', 'TIMESLOT_HAS_APPOINTMENT');
      }

      tx.delete(timeslots).where(eq(timeslots.id, slot.id)).run();
    });

    return reply.code(204).send();
  });

  app.get('/mechanics', { preHandler: authenticate }, async () => {
    return db.select(publicMechanicColumns).from(publicMechanics).orderBy(asc(publicMechanics.name)).all();
  });

  app.get<{ Params: { id: string } }>('/mechanics/:id', { preHandler: authenticate }, async (request) => {
    const row = db
      .select(publicMechanicColumns)
      .from(publicMechanics)
      .where(eq(publicMechanics.id, request.params.id))
      .get();

    if (!row) {
      throw mechanicNotFound();
    }

    return row;
  });

  app.get<{ Params: { id: string }; Querystring: { date?: string } }>(
    '/mechanics/:id/timeslots',
    { preHandler: authenticate },
    async (request) => {
      const requestedDate = request.query.date;
      const mechanic = db
        .select({ id: publicMechanics.id })
        .from(publicMechanics)
        .where(eq(publicMechanics.id, request.params.id))
        .get();

      if (!mechanic) {
        throw mechanicNotFound();
      }

      if (requestedDate !== undefined && !isDateString(requestedDate)) {
        throw new HttpError(400, 'invalid request query', 'VALIDATION_FAILED');
      }

      const now = getSaoPauloDateTimeParts();

      if (requestedDate !== undefined && requestedDate < now.date) {
        return [];
      }

      const dateFilter =
        requestedDate === undefined
          ? and(
              gte(timeslots.date, now.date),
              lte(timeslots.date, addDays(now.date, 6)),
              sql`(${timeslots.date} > ${now.date} OR (${timeslots.date} = ${now.date} AND ${timeslots.startTime} > ${now.time}))`,
            )
          : and(
              eq(timeslots.date, requestedDate),
              requestedDate === now.date ? sql`${timeslots.startTime} > ${now.time}` : sql`1 = 1`,
            );

      return db
        .select(timeslotColumns)
        .from(timeslots)
        .innerJoin(mechanics, and(eq(mechanics.id, timeslots.mechanicId), eq(mechanics.isActive, true)))
        .leftJoin(
          appointments,
          and(
            eq(appointments.timeslotId, timeslots.id),
            sql`${appointments.status} IN ('confirmado', 'nao_finalizado')`,
          ),
        )
        .where(
          and(
            eq(timeslots.mechanicId, request.params.id),
            eq(timeslots.isAvailable, true),
            isNull(appointments.id),
            dateFilter,
          ),
        )
        .orderBy(asc(timeslots.date), asc(timeslots.startTime))
        .all();
    },
  );
}
