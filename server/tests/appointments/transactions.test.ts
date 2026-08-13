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

    expect(() => mapAppointmentWriteError(error, true)).toThrow(error);
  });
});
