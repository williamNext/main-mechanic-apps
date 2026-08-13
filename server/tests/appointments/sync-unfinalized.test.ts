import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncUnfinalized } from '../../src/appointments/sync-unfinalized.js';
import { insertAppointment, insertMechanic, makeUserToken } from '../helpers/appointments.js';
import { makeTestDb } from '../helpers/db.js';

describe('syncUnfinalized', () => {
  let testDb: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    testDb.cleanup();
  });

  it('does not issue UPDATE when no row needs transitioning', () => {
    const client = makeUserToken(testDb);
    const mechanicId = insertMechanic(testDb);
    insertAppointment(testDb, { clientId: client.id, mechanicId, date: '2026-08-12' });
    const update = vi.spyOn(testDb.db, 'update');

    syncUnfinalized(testDb.db);

    expect(update).not.toHaveBeenCalled();
  });

  it('issues global UPDATE outside a transaction only when a past confirmed row exists', () => {
    const first = makeUserToken(testDb);
    const second = makeUserToken(testDb);
    const mechanicId = insertMechanic(testDb);
    const firstId = insertAppointment(testDb, {
      clientId: first.id,
      mechanicId,
      date: '2026-08-10',
      status: 'confirmado',
    });
    const secondId = insertAppointment(testDb, {
      clientId: second.id,
      mechanicId,
      date: '2026-08-11',
      status: 'confirmado',
    });
    const transactionStates: boolean[] = [];
    const originalUpdate = testDb.db.update.bind(testDb.db);
    vi.spyOn(testDb.db, 'update').mockImplementation(((table) => {
      transactionStates.push(testDb.connection.inTransaction);
      return originalUpdate(table);
    }) as typeof testDb.db.update);

    syncUnfinalized(testDb.db);

    expect(transactionStates).toEqual([false]);
    const rows = testDb.connection
      .prepare('SELECT id, status FROM appointments WHERE id IN (?, ?) ORDER BY id')
      .all(firstId, secondId);
    expect(rows).toEqual(
      [firstId, secondId].sort().map((id) => ({ id, status: 'nao_finalizado' })),
    );
  });
});
