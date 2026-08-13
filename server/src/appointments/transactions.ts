import type { Db } from '../db/client.js';
import { HttpError } from '../errors.js';

type SqliteError = Error & { code?: string };

export function mapAppointmentWriteError(error: unknown, mapTimeslotUnique = false): never {
  if (error instanceof HttpError) {
    throw error;
  }

  const sqliteError = error as SqliteError;
  if (sqliteError.code === 'SQLITE_BUSY') {
    throw new HttpError(503, 'database busy', 'DATABASE_BUSY');
  }
  if (
    mapTimeslotUnique &&
    sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    sqliteError.message.includes('appointments.timeslot_id')
  ) {
    throw new HttpError(409, 'timeslot unavailable', 'TIMESLOT_UNAVAILABLE');
  }

  throw error;
}

export function runImmediateTransaction<T>(
  db: Db,
  callback: Parameters<Db['transaction']>[0],
  mapTimeslotUnique = false,
): T {
  try {
    return db.transaction(callback, { behavior: 'immediate' }) as T;
  } catch (error) {
    return mapAppointmentWriteError(error, mapTimeslotUnique);
  }
}
