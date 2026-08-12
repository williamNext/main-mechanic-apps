import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

function makeClientToken(testDb: TestDb): string {
  const id = insertProfile(testDb, {
    name: 'Client Caller',
    email: `${randomUUID()}@example.com`,
    role: 'client',
  });
  return signAccessToken({ userId: id, role: 'client' }).token;
}

function insertMechanic(
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
      overrides.startTime ?? '09:00',
      overrides.endTime ?? '10:00',
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
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO appointments
         (id, client_id, mechanic_id, timeslot_id, date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.clientId,
      overrides.mechanicId,
      overrides.timeslotId === undefined ? null : overrides.timeslotId,
      overrides.date ?? '2026-09-01',
      overrides.startTime ?? '09:00',
      overrides.endTime ?? '10:00',
      overrides.status ?? 'confirmado',
    );
  return id;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function setPublicMechanicProjection(
  testDb: TestDb,
  id: string,
  values: { name: string; specialty: string; avatarUrl: string | null; updatedAt: string },
) {
  testDb.connection
    .prepare('UPDATE public_mechanics SET name = ?, specialty = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
    .run(values.name, values.specialty, values.avatarUrl, values.updatedAt, id);
}

describe('GET /mechanics', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let token: string;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    token = makeClientToken(testDb);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('returns active mechanics from public_mechanics with camelCase fields', async () => {
    const mechanicId = insertMechanic(testDb, {
      name: 'Private Base Name',
      email: 'base-mechanic@example.com',
      phone: '+5511888888888',
      avatarUrl: 'https://cdn.example.com/private.png',
      specialty: 'Base Specialty',
    });
    const projection = {
      name: 'Public Projection Name',
      specialty: 'Public Projection Specialty',
      avatarUrl: 'https://cdn.example.com/public.png',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    setPublicMechanicProjection(testDb, mechanicId, projection);

    const res = await app.inject({
      method: 'GET',
      url: '/mechanics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: mechanicId, ...projection }]);
  });

  it('never exposes email or phone keys', async () => {
    insertMechanic(testDb, {
      name: 'No Secret Leak',
      email: 'secret-mechanic@example.com',
      phone: '+5511777777777',
      specialty: 'Motor',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/mechanics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('"email"');
    expect(res.body).not.toContain('"phone"');
  });

  it('does not list deactivated mechanics', async () => {
    const activeId = insertMechanic(testDb, { name: 'Active Mechanic', specialty: 'Motor' });
    const inactiveId = insertMechanic(testDb, { name: 'Inactive Mechanic', specialty: 'Cambio', isActive: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/mechanics',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((mechanic: { id: string }) => mechanic.id);
    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
  });
});

describe('GET /mechanics/:id/timeslots', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let token: string;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    token = makeClientToken(testDb);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('returns a requested day of bookable slots with camelCase fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const mechanicId = insertMechanic(testDb);
    const later = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '10:00',
      endTime: '11:00',
    });
    const earlier = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '09:00',
      endTime: '10:00',
    });
    insertTimeslot(testDb, { mechanicId, date: '2026-08-14', startTime: '09:00', endTime: '10:00' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-13`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { id: earlier, mechanicId, date: '2026-08-13', startTime: '09:00', endTime: '10:00', isAvailable: true },
      { id: later, mechanicId, date: '2026-08-13', startTime: '10:00', endTime: '11:00', isAvailable: true },
    ]);
  });

  it('omits slots taken by confirmado or nao_finalizado appointments but not cancelado appointments', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const clientId = insertProfile(testDb, { role: 'client' });
    const mechanicId = insertMechanic(testDb);
    const confirmed = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '09:00',
      endTime: '10:00',
    });
    const unfinished = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '10:00',
      endTime: '11:00',
    });
    const canceled = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '11:00',
      endTime: '12:00',
    });
    insertAppointment(testDb, { clientId, mechanicId, timeslotId: confirmed, date: '2026-08-13', startTime: '09:00', endTime: '10:00', status: 'confirmado' });
    insertAppointment(testDb, { clientId, mechanicId, timeslotId: unfinished, date: '2026-08-13', startTime: '10:00', endTime: '11:00', status: 'nao_finalizado' });
    insertAppointment(testDb, { clientId, mechanicId, timeslotId: canceled, date: '2026-08-13', startTime: '11:00', endTime: '12:00', status: 'cancelado' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-13`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().map((slot: { id: string }) => slot.id)).toEqual([canceled]);
  });

  it('omits today slots whose start time has passed in Sao Paulo time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:30:00.000Z'));
    const mechanicId = insertMechanic(testDb);
    insertTimeslot(testDb, { mechanicId, date: '2026-08-12', startTime: '11:00', endTime: '12:00' });
    const future = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-12',
      startTime: '13:00',
      endTime: '14:00',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-12`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().map((slot: { id: string }) => slot.id)).toEqual([future]);
  });

  it('uses Sao Paulo time instead of the UTC host timezone or a fixed minus-three offset', async () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'UTC';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2018-12-01T02:30:00.000Z'));
    expect(new Date('2018-12-01T02:30:00.000Z').getHours()).toBe(2);
    const mechanicId = insertMechanic(testDb);
    insertTimeslot(testDb, { mechanicId, date: '2018-12-01', startTime: '00:15', endTime: '00:30' });
    const saoPauloFuture = insertTimeslot(testDb, {
      mechanicId,
      date: '2018-12-01',
      startTime: '00:45',
      endTime: '01:00',
    });
    const utcFuture = insertTimeslot(testDb, { mechanicId, date: '2018-12-01', startTime: '03:00', endTime: '04:00' });

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/mechanics/${mechanicId}/timeslots?date=2018-12-01`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().map((slot: { id: string }) => slot.id)).toEqual([saoPauloFuture, utcFuture]);
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });

  it('returns an empty list for a past date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const mechanicId = insertMechanic(testDb);
    insertTimeslot(testDb, { mechanicId, date: '2026-08-11', startTime: '23:00', endTime: '23:30' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-11`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('bounds requests without date to today through six days ahead', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const mechanicId = insertMechanic(testDb);
    const dates = Array.from({ length: 8 }, (_, i) => addDays('2026-08-12', i));
    const included = dates.slice(0, 7).map((date, i) =>
      insertTimeslot(testDb, { mechanicId, date, startTime: i === 0 ? '13:00' : '09:00', endTime: i === 0 ? '14:00' : '10:00' }),
    );
    const dayEight = insertTimeslot(testDb, { mechanicId, date: dates[7], startTime: '09:00', endTime: '10:00' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const ids = res.json().map((slot: { id: string }) => slot.id);
    expect(ids).toEqual(included);
    expect(ids).not.toContain(dayEight);
  });

  it('returns identical 404 MECHANIC_NOT_FOUND responses for unknown and deactivated mechanics', async () => {
    const mechanicId = insertMechanic(testDb, { isActive: 0 });
    insertTimeslot(testDb, { mechanicId, date: '2026-08-13', startTime: '09:00', endTime: '10:00' });

    const deactivated = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-13`,
      headers: { authorization: `Bearer ${token}` },
    });
    const unknown = await app.inject({
      method: 'GET',
      url: `/mechanics/${randomUUID()}/timeslots?date=2026-08-13`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deactivated.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(deactivated.body).toBe(unknown.body);
    expect(deactivated.json()).toEqual({ error: 'mechanic not found', code: 'MECHANIC_NOT_FOUND' });
  });

  it('orders results by date and then startTime', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const mechanicId = insertMechanic(testDb);
    const secondDateEarly = insertTimeslot(testDb, { mechanicId, date: '2026-08-13', startTime: '09:00', endTime: '10:00' });
    const firstDateLate = insertTimeslot(testDb, { mechanicId, date: '2026-08-12', startTime: '14:00', endTime: '15:00' });
    const firstDateEarly = insertTimeslot(testDb, { mechanicId, date: '2026-08-12', startTime: '13:00', endTime: '14:00' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().map((slot: { id: string }) => slot.id)).toEqual([firstDateEarly, firstDateLate, secondDateEarly]);
  });

  it('rejects malformed date with VALIDATION_FAILED', async () => {
    const mechanicId = insertMechanic(testDb);

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-8-13`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request query', code: 'VALIDATION_FAILED' });
  });

  it('does not expose an availableOnly switch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    const clientId = insertProfile(testDb, { role: 'client' });
    const mechanicId = insertMechanic(testDb);
    const taken = insertTimeslot(testDb, { mechanicId, date: '2026-08-13', startTime: '09:00', endTime: '10:00' });
    const open = insertTimeslot(testDb, { mechanicId, date: '2026-08-13', startTime: '10:00', endTime: '11:00' });
    insertAppointment(testDb, { clientId, mechanicId, timeslotId: taken, date: '2026-08-13', startTime: '09:00', endTime: '10:00', status: 'confirmado' });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-13&availableOnly=false`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().map((slot: { id: string }) => slot.id)).toEqual([open]);
  });
});

describe('GET /mechanics/:id', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let token: string;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    token = makeClientToken(testDb);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('returns one mechanic from public_mechanics in the list shape', async () => {
    const mechanicId = insertMechanic(testDb, {
      name: 'Detail Base Name',
      email: 'detail-base@example.com',
      phone: '+5511666666666',
      avatarUrl: 'https://cdn.example.com/detail-private.png',
      specialty: 'Detail Base Specialty',
    });
    const projection = {
      name: 'Detail Projection Name',
      specialty: 'Detail Projection Specialty',
      avatarUrl: 'https://cdn.example.com/detail-public.png',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    setPublicMechanicProjection(testDb, mechanicId, projection);

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: mechanicId, ...projection });
  });

  it('never exposes email or phone keys', async () => {
    const mechanicId = insertMechanic(testDb, {
      name: 'Detail No Secret Leak',
      email: 'detail-secret@example.com',
      phone: '+5511555555555',
      specialty: 'Suspensao',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('"email"');
    expect(res.body).not.toContain('"phone"');
  });

  it('returns identical 404 MECHANIC_NOT_FOUND responses for deactivated and unknown mechanics', async () => {
    const mechanicId = insertMechanic(testDb, { name: 'Withdrawn Mechanic', specialty: 'Injecao' });
    testDb.connection.prepare('UPDATE mechanics SET is_active = 0 WHERE id = ?').run(mechanicId);

    const deactivated = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const unknown = await app.inject({
      method: 'GET',
      url: `/mechanics/${randomUUID()}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deactivated.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(deactivated.body).toBe(unknown.body);
    expect(deactivated.json()).toEqual({ error: 'mechanic not found', code: 'MECHANIC_NOT_FOUND' });
  });
});

describe('mechanics auth', () => {
  let testDb: TestDb;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('rejects unauthenticated list requests before any row lookup', async () => {
    const selectSpy = vi.spyOn(testDb.db, 'select');

    const res = await app.inject({ method: 'GET', url: '/mechanics' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated detail requests before any row lookup', async () => {
    const selectSpy = vi.spyOn(testDb.db, 'select');

    const res = await app.inject({ method: 'GET', url: `/mechanics/${randomUUID()}` });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated timeslot requests before any row lookup', async () => {
    const selectSpy = vi.spyOn(testDb.db, 'select');

    const res = await app.inject({ method: 'GET', url: `/mechanics/${randomUUID()}/timeslots?date=2026-08-13` });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
    expect(selectSpy).not.toHaveBeenCalled();
  });
});
