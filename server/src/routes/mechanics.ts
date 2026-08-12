import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import type { Db } from '../db/client.js';
import { appointments, mechanics, publicMechanics, timeslots } from '../db/schema.js';
import { HttpError } from '../errors.js';

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

function getSaoPauloDateTimeParts(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
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
