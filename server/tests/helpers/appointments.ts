import { randomUUID } from 'node:crypto';
import { signAccessToken } from '../../src/auth/jwt.js';
import type { AppointmentStatus, Role } from '../../src/db/schema.js';
import type { makeTestDb } from './db.js';
import { insertProfile } from './profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

export function makeUserToken(testDb: TestDb, role: Role = 'client') {
  const id = insertProfile(testDb, { role });
  const token = signAccessToken({ userId: id, role }).token;
  return { id, token };
}

export function insertMechanic(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    specialty: string;
    credentials: string;
    isActive: number;
  }> = {},
): string {
  const id = insertProfile(testDb, {
    id: overrides.id,
    name: overrides.name ?? 'Mechanic Person',
    email: overrides.email ?? `${randomUUID()}@example.com`,
    role: 'mechanic',
    phone: overrides.phone ?? '+5511999999999',
    avatarUrl: overrides.avatarUrl ?? null,
  });
  testDb.connection
    .prepare('INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)')
    .run(id, overrides.specialty ?? 'Freios', overrides.credentials ?? 'ASE', overrides.isActive ?? 1);
  return id;
}

export function insertTimeslot(
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
      overrides.startTime ?? '09:00',
      overrides.endTime ?? '10:00',
      overrides.isAvailable ?? 1,
    );
  return id;
}

export function insertAppointment(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    clientId: string;
    mechanicId: string;
    timeSlotId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
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
      overrides.timeSlotId === undefined ? null : overrides.timeSlotId,
      overrides.date ?? '2026-09-01',
      overrides.startTime ?? '09:00',
      overrides.endTime ?? '10:00',
      overrides.status ?? 'confirmado',
      overrides.vehicleInfo ?? null,
      overrides.notes ?? null,
    );
  return id;
}
