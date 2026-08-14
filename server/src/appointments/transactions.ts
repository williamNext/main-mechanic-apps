import type { Db } from '../db/client.js';
import { HttpError } from '../errors.js';

type SqliteError = Error & { code?: string };

export type WriteErrorMappings = {
  appointmentsTimeslotUnique?: boolean;
  timeslotIntervalUnique?: boolean;
};

export function mapAppointmentWriteError(error: unknown, mappings: WriteErrorMappings = {}): never {
  if (error instanceof HttpError) {
    throw error;
  }

  const sqliteError = error as SqliteError;
  if (sqliteError.code === 'SQLITE_BUSY') {
    throw new HttpError(503, 'database busy', 'DATABASE_BUSY');
  }
  if (
    mappings.appointmentsTimeslotUnique &&
    sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    sqliteError.message.includes('appointments.timeslot_id')
  ) {
    throw new HttpError(409, 'timeslot unavailable', 'TIMESLOT_UNAVAILABLE');
  }
  if (
    mappings.timeslotIntervalUnique &&
    sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    sqliteError.message.includes('timeslots_mechanic_date_time_unique_idx')
  ) {
    throw new HttpError(409, 'timeslot overlap', 'TIMESLOT_OVERLAP');
  }

  throw error;
}

export function runImmediateTransaction<T>(
  db: Db,
  callback: Parameters<Db['transaction']>[0],
  mappings: WriteErrorMappings = {},
): T {
  try {
    return db.transaction(callback, { behavior: 'immediate' }) as T;
  } catch (error) {
    return mapAppointmentWriteError(error, mappings);
  }
}
