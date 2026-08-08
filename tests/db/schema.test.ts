import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../helpers/db.js';

type TestDb = ReturnType<typeof makeTestDb>;

function nowIso() {
  return new Date().toISOString();
}

function insertProfile(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
    avatarUrl: string | null;
    passwordHash: string;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO profiles (id, name, email, role, phone, avatar_url, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.name ?? 'Test Person',
      overrides.email ?? `${id}@example.com`,
      overrides.role ?? 'client',
      overrides.phone ?? null,
      overrides.avatarUrl ?? null,
      overrides.passwordHash ?? 'hash',
    );
  return id;
}

function insertMechanic(
  testDb: TestDb,
  overrides: Partial<{ id: string; specialty: string; credentials: string; isActive: number }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  const hasIsActive = Object.prototype.hasOwnProperty.call(overrides, 'isActive');
  if (hasIsActive) {
    testDb.connection
      .prepare(`INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)`)
      .run(id, overrides.specialty ?? 'Motor', overrides.credentials ?? 'PENDENTE', overrides.isActive);
  } else {
    testDb.connection
      .prepare(`INSERT INTO mechanics (id, specialty, credentials) VALUES (?, ?, ?)`)
      .run(id, overrides.specialty ?? 'Motor', overrides.credentials ?? 'PENDENTE');
  }
  return id;
}

/** Inserts a profile with role=mechanic and a matching mechanics row, returns the shared id. */
function insertMechanicWithProfile(testDb: TestDb): string {
  const id = insertProfile(testDb, { role: 'mechanic' });
  insertMechanic(testDb, { id });
  return id;
}

function insertTimeslot(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    mechanicId: string;
    date: string;
    startTime: string;
    endTime: string;
    isAvailable: number;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO timeslots (id, mechanic_id, date, start_time, end_time, is_available)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.mechanicId,
      overrides.date ?? '2026-09-01',
      overrides.startTime ?? '09:00:00',
      overrides.endTime ?? '10:00:00',
      overrides.isAvailable ?? 1,
    );
  return id;
}

function insertAppointment(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    clientId: string;
    mechanicId: string;
    timeslotId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    vehicleInfo: string | null;
    notes: string | null;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO appointments
         (id, client_id, mechanic_id, timeslot_id, date, start_time, end_time, status, vehicle_info, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.clientId,
      overrides.mechanicId,
      overrides.timeslotId === undefined ? null : overrides.timeslotId,
      overrides.date ?? '2026-09-01',
      overrides.startTime ?? '09:00:00',
      overrides.endTime ?? '10:00:00',
      overrides.status ?? 'confirmado',
      overrides.vehicleInfo ?? null,
      overrides.notes ?? null,
    );
  return id;
}

function insertServiceReport(
  testDb: TestDb,
  overrides: Partial<{
    appointmentId: string;
    mechanicId: string;
    summary: string;
    diagnosis: string | null;
    workPerformed: string;
    partsUsed: string | null;
    recommendations: string | null;
    totalAmountCents: number;
  }> = {},
): string {
  const appointmentId = overrides.appointmentId!;
  testDb.connection
    .prepare(
      `INSERT INTO appointment_service_reports
         (appointment_id, mechanic_id, summary, diagnosis, work_performed, parts_used, recommendations, total_amount_cents, closed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      appointmentId,
      overrides.mechanicId,
      overrides.summary ?? 'Replaced brake pads',
      overrides.diagnosis ?? null,
      overrides.workPerformed ?? 'Removed old pads and installed new ones',
      overrides.partsUsed ?? null,
      overrides.recommendations ?? null,
      overrides.totalAmountCents ?? 5000,
      nowIso(),
      nowIso(),
      nowIso(),
    );
  return appointmentId;
}

function insertServiceItem(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    appointmentId: string;
    description: string;
    amountCents: number;
    sortOrder: number;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO appointment_service_items (id, appointment_id, description, amount_cents, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.appointmentId,
      overrides.description ?? 'Brake pads',
      overrides.amountCents ?? 5000,
      overrides.sortOrder ?? 0,
      nowIso(),
    );
  return id;
}

function insertAdminActionLog(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    actorId: string | null;
    targetMechanicId: string | null;
    action: string;
    note: string | null;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO admin_action_log (id, actor_id, target_mechanic_id, action, note)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, overrides.actorId ?? null, overrides.targetMechanicId ?? null, overrides.action, overrides.note ?? null);
  return id;
}

describe('DATA-01: full nine-table schema', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it('creates all nine DATA-01 tables', () => {
    const rows = testDb.connection
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'`,
      )
      .all() as { name: string }[];
    const names = new Set(rows.map((r) => r.name));
    const want = [
      'profiles',
      'mechanics',
      'public_mechanics',
      'timeslots',
      'appointments',
      'appointment_service_reports',
      'appointment_service_items',
      'admin_action_log',
      'notifications',
    ];
    for (const table of want) {
      expect(names.has(table)).toBe(true);
    }
  });

  describe('notifications column set (DATA-02)', () => {
    it('has exactly the eleven client-evidenced columns', () => {
      const cols = testDb.connection.prepare('PRAGMA table_info(notifications)').all() as { name: string }[];
      const names = new Set(cols.map((c) => c.name));
      const want = new Set([
        'id',
        'recipient_id',
        'actor_id',
        'appointment_id',
        'type',
        'title',
        'body',
        'data',
        'read_at',
        'created_at',
        'updated_at',
      ]);
      expect(names).toEqual(want);
    });

    it('defaults data to the empty-object literal and read_at to null when omitted', () => {
      const recipientId = insertProfile(testDb, { role: 'client' });
      const notificationId = randomUUID();
      testDb.connection
        .prepare(
          `INSERT INTO notifications (id, recipient_id, type, title, body, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(notificationId, recipientId, 'booking_confirmed', 'Booking confirmed', 'Your booking is set', nowIso(), nowIso());

      const row = testDb.connection.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as {
        data: string;
        read_at: string | null;
      };
      expect(row.data).toBe('{}');
      expect(row.read_at).toBeNull();
    });
  });

  describe('public_mechanics projection column set (DATA-03 privacy prohibition)', () => {
    it('has exactly five columns and no contact or credential field', () => {
      const cols = testDb.connection.prepare('PRAGMA table_info(public_mechanics)').all() as { name: string }[];
      const names = new Set(cols.map((c) => c.name));
      expect(names).toEqual(new Set(['id', 'name', 'specialty', 'avatar_url', 'updated_at']));
      expect(names.has('email')).toBe(false);
      expect(names.has('phone')).toBe(false);
      expect(names.has('password_hash')).toBe(false);
    });
  });

  describe('constraint enforcement — each insert must throw', () => {
    it('rejects an appointments row whose status is outside the four-value set', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      expect(() =>
        insertAppointment(testDb, { clientId, mechanicId, status: 'bogus_status' }),
      ).toThrow();
    });

    it('rejects a second confirmado appointment on the same timeslot', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const timeslotId = insertTimeslot(testDb, { mechanicId });
      insertAppointment(testDb, { clientId, mechanicId, timeslotId, status: 'confirmado' });

      const secondClientId = insertProfile(testDb, { role: 'client' });
      expect(() =>
        insertAppointment(testDb, { clientId: secondClientId, mechanicId, timeslotId, status: 'confirmado' }),
      ).toThrow();
    });

    it('rejects a nao_finalizado appointment reusing a timeslot already held by a confirmado row', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const timeslotId = insertTimeslot(testDb, { mechanicId });
      insertAppointment(testDb, { clientId, mechanicId, timeslotId, status: 'confirmado' });

      const secondClientId = insertProfile(testDb, { role: 'client' });
      expect(() =>
        insertAppointment(testDb, { clientId: secondClientId, mechanicId, timeslotId, status: 'nao_finalizado' }),
      ).toThrow();
    });

    it('rejects a timeslot whose end_time is equal to or earlier than its start_time', () => {
      const mechanicId = insertMechanicWithProfile(testDb);
      expect(() => insertTimeslot(testDb, { mechanicId, startTime: '10:00:00', endTime: '10:00:00' })).toThrow();
      expect(() =>
        insertTimeslot(testDb, { mechanicId, date: '2026-09-02', startTime: '10:00:00', endTime: '09:00:00' }),
      ).toThrow();
    });

    it('rejects a service item with a negative amount_cents or a negative sort_order', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const appointmentId = insertAppointment(testDb, { clientId, mechanicId });
      insertServiceReport(testDb, { appointmentId, mechanicId });

      expect(() => insertServiceItem(testDb, { appointmentId, amountCents: -100, sortOrder: 0 })).toThrow();
      expect(() => insertServiceItem(testDb, { appointmentId, amountCents: 100, sortOrder: -1 })).toThrow();
    });

    it('rejects a service report whose summary or work_performed is too short', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const appointmentId = insertAppointment(testDb, { clientId, mechanicId });

      expect(() => insertServiceReport(testDb, { appointmentId, mechanicId, summary: 'ab' })).toThrow();
      expect(() => insertServiceReport(testDb, { appointmentId, mechanicId, workPerformed: 'ab' })).toThrow();
    });

    it('rejects an admin_action_log row whose action is outside the allowed set', () => {
      expect(() => insertAdminActionLog(testDb, { action: 'approve_mechanic' })).toThrow();
    });

    it('rejects a mechanics row whose id does not exist in profiles', () => {
      expect(() => insertMechanic(testDb, { id: randomUUID() })).toThrow();
    });
  });

  describe('constraint permissiveness — each insert must succeed', () => {
    it('allows rebooking a timeslot whose existing appointment is cancelado', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const timeslotId = insertTimeslot(testDb, { mechanicId });
      insertAppointment(testDb, { clientId, mechanicId, timeslotId, status: 'cancelado' });

      expect(() =>
        insertAppointment(testDb, { clientId, mechanicId, timeslotId, status: 'confirmado' }),
      ).not.toThrow();
    });

    it('allows two appointments rows that both have a null timeslot_id', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);

      expect(() => {
        insertAppointment(testDb, { clientId, mechanicId, timeslotId: null });
        insertAppointment(testDb, { clientId, mechanicId, timeslotId: null });
      }).not.toThrow();
    });

    it('defaults mechanics.is_active to true (1) when omitted entirely', () => {
      const profileId = insertProfile(testDb, { role: 'mechanic' });
      testDb.connection.prepare('INSERT INTO mechanics (id, specialty) VALUES (?, ?)').run(profileId, 'Motor');

      const row = testDb.connection.prepare('SELECT is_active FROM mechanics WHERE id = ?').get(profileId) as {
        is_active: number;
      };
      expect(row.is_active).toBe(1);
    });

    it('accepts admin_action_log rows with action create_mechanic and delete_mechanic', () => {
      expect(() => insertAdminActionLog(testDb, { action: 'create_mechanic' })).not.toThrow();
      expect(() => insertAdminActionLog(testDb, { action: 'delete_mechanic' })).not.toThrow();
    });
  });

  describe('cascade behavior', () => {
    it('deleting a profiles row deletes its mechanics row', () => {
      const mechanicId = insertMechanicWithProfile(testDb);
      testDb.connection.prepare('DELETE FROM profiles WHERE id = ?').run(mechanicId);

      const row = testDb.connection.prepare('SELECT * FROM mechanics WHERE id = ?').get(mechanicId);
      expect(row).toBeUndefined();
    });

    it('deleting an appointment_service_reports row deletes its appointment_service_items rows', () => {
      const clientId = insertProfile(testDb, { role: 'client' });
      const mechanicId = insertMechanicWithProfile(testDb);
      const appointmentId = insertAppointment(testDb, { clientId, mechanicId });
      insertServiceReport(testDb, { appointmentId, mechanicId });
      insertServiceItem(testDb, { appointmentId });

      testDb.connection.prepare('DELETE FROM appointment_service_reports WHERE appointment_id = ?').run(appointmentId);

      const items = testDb.connection
        .prepare('SELECT * FROM appointment_service_items WHERE appointment_id = ?')
        .all(appointmentId);
      expect(items.length).toBe(0);
    });
  });
});
