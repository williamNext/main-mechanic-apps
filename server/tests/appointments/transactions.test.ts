import { describe, expect, it } from 'vitest';
import { mapAppointmentWriteError } from '../../src/appointments/transactions.js';
import { HttpError } from '../../src/errors.js';

describe('appointment write error mapping', () => {
  it('maps SQLITE_BUSY to 503 DATABASE_BUSY', () => {
    const error = Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' });

    try {
      mapAppointmentWriteError(error);
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(HttpError);
      expect(mapped).toMatchObject({ status: 503, message: 'database busy', code: 'DATABASE_BUSY' });
    }
  });

  it('does not map unrelated unique violations as timeslot conflicts', () => {
    const error = Object.assign(new Error('UNIQUE constraint failed: appointments.id'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });

    expect(() => mapAppointmentWriteError(error, { appointmentsTimeslotUnique: true })).toThrow(error);
  });

  it('keeps mapping the appointments timeslot unique violation to 409 TIMESLOT_UNAVAILABLE', () => {
    const error = Object.assign(new Error('UNIQUE constraint failed: appointments.timeslot_id'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });

    try {
      mapAppointmentWriteError(error, { appointmentsTimeslotUnique: true });
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(HttpError);
      expect(mapped).toMatchObject({
        status: 409,
        message: 'timeslot unavailable',
        code: 'TIMESLOT_UNAVAILABLE',
      });
    }
  });

  it('maps the timeslots interval unique violation to 409 TIMESLOT_OVERLAP', () => {
    const error = Object.assign(
      new Error('UNIQUE constraint failed: timeslots_mechanic_date_time_unique_idx'),
      { code: 'SQLITE_CONSTRAINT_UNIQUE' },
    );

    try {
      mapAppointmentWriteError(error, { timeslotIntervalUnique: true });
    } catch (mapped) {
      expect(mapped).toBeInstanceOf(HttpError);
      expect(mapped).toMatchObject({ status: 409, message: 'timeslot overlap', code: 'TIMESLOT_OVERLAP' });
    }
  });
});
