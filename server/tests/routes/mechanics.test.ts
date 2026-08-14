import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';
import { insertAppointment, insertMechanic, insertTimeslot } from '../helpers/appointments.js';

type TestDb = ReturnType<typeof makeTestDb>;

function makeClientToken(testDb: TestDb): string {
  const id = insertProfile(testDb, {
    name: 'Client Caller',
    email: `${randomUUID()}@example.com`,
    role: 'client',
  });
  return signAccessToken({ userId: id, role: 'client' }).token;
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

describe('POST /timeslots', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let mechanic: ReturnType<typeof makeMechanicToken>;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    mechanic = makeMechanicToken(testDb);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-14T15:00:00.000Z'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('creates one slot from an object and returns an array of one', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual([
      {
        id: expect.any(String),
        mechanicId: mechanic.id,
        date: '2026-08-15',
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true,
      },
    ]);
  });

  it('creates every slot in a batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: [
        { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
        { date: '2026-08-15', startTime: '14:00', endTime: '15:00' },
      ],
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveLength(2);
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM timeslots').get()).toEqual({ count: 2 });
  });

  it('accepts slots that share only an endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: [
        { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
        { date: '2026-08-15', startTime: '10:00', endTime: '11:00' },
      ],
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveLength(2);
  });

  it('refuses a slot that overlaps a stored slot', async () => {
    insertTimeslot(testDb, {
      mechanicId: mechanic.id,
      date: '2026-08-15',
      startTime: '09:00',
      endTime: '10:00',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: { date: '2026-08-15', startTime: '09:30', endTime: '10:30' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'timeslot overlap', code: 'TIMESLOT_OVERLAP' });
  });

  it('refuses a slot that overlaps an unavailable stored slot', async () => {
    insertTimeslot(testDb, {
      mechanicId: mechanic.id,
      date: '2026-08-15',
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: { date: '2026-08-15', startTime: '08:30', endTime: '09:30' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'timeslot overlap', code: 'TIMESLOT_OVERLAP' });
  });

  it('rejects an internally overlapping batch without inserting any rows', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: [
        { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
        { date: '2026-08-15', startTime: '09:30', endTime: '10:30' },
      ],
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'timeslot overlap', code: 'TIMESLOT_OVERLAP' });
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM timeslots').get()).toEqual({ count: 0 });
  });

  it('rejects a mixed-date batch with VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: [
        { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
        { date: '2026-08-16', startTime: '10:00', endTime: '11:00' },
      ],
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM timeslots').get()).toEqual({ count: 0 });
  });

  it('refuses a slot starting earlier today in Sao Paulo time under a frozen clock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: { date: '2026-08-14', startTime: '11:00', endTime: '12:00' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'timeslot expired', code: 'TIMESLOT_EXPIRED' });
  });

  it('refuses client callers with FORBIDDEN', async () => {
    const token = makeClientToken(testDb);

    const res = await app.inject({
      method: 'POST',
      url: '/timeslots',
      headers: { authorization: `Bearer ${token}` },
      payload: { date: '2026-08-15', startTime: '09:00', endTime: '10:00' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});

describe('PATCH /timeslots/:id', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let mechanic: ReturnType<typeof makeMechanicToken>;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    mechanic = makeMechanicToken(testDb);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('blocks an owned available slot', async () => {
    const id = insertTimeslot(testDb, { mechanicId: mechanic.id });

    const res = await app.inject({
      method: 'PATCH',
      url: `/timeslots/${id}`,
      headers: { authorization: `Bearer ${mechanic.token}` },
      payload: { isAvailable: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, mechanicId: mechanic.id, isAvailable: false });
  });

  it.each(['confirmado', 'nao_finalizado', 'acabado'] as const)(
    'refuses unblocking a slot referenced by a %s appointment',
    async (status) => {
      const id = insertTimeslot(testDb, { mechanicId: mechanic.id, isAvailable: 0 });
      const clientId = insertProfile(testDb, { role: 'client' });
      insertAppointment(testDb, { clientId, mechanicId: mechanic.id, timeslotId: id, status });

      const res = await app.inject({
        method: 'PATCH',
        url: `/timeslots/${id}`,
        headers: { authorization: `Bearer ${mechanic.token}` },
        payload: { isAvailable: true },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'timeslot has appointment', code: 'TIMESLOT_HAS_APPOINTMENT' });
    },
  );

  it('returns TIMESLOT_NOT_FOUND to non-owning mechanics and clients', async () => {
    const id = insertTimeslot(testDb, { mechanicId: mechanic.id });
    const otherMechanic = makeMechanicToken(testDb);
    const clientToken = makeClientToken(testDb);

    for (const token of [otherMechanic.token, clientToken]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/timeslots/${id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { isAvailable: false },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'timeslot not found', code: 'TIMESLOT_NOT_FOUND' });
    }
  });
});

describe('DELETE /timeslots/:id', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let mechanic: ReturnType<typeof makeMechanicToken>;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    mechanic = makeMechanicToken(testDb);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it.each(['confirmado', 'nao_finalizado'] as const)(
    'refuses deleting a slot referenced by a %s appointment',
    async (status) => {
      const id = insertTimeslot(testDb, { mechanicId: mechanic.id, isAvailable: 0 });
      const clientId = insertProfile(testDb, { role: 'client' });
      insertAppointment(testDb, { clientId, mechanicId: mechanic.id, timeslotId: id, status });

      const res = await app.inject({
        method: 'DELETE',
        url: `/timeslots/${id}`,
        headers: { authorization: `Bearer ${mechanic.token}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'timeslot has appointment', code: 'TIMESLOT_HAS_APPOINTMENT' });
    },
  );

  it('deletes a merely blocked slot', async () => {
    const id = insertTimeslot(testDb, { mechanicId: mechanic.id, isAvailable: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: `/timeslots/${id}`,
      headers: { authorization: `Bearer ${mechanic.token}` },
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(testDb.connection.prepare('SELECT id FROM timeslots WHERE id = ?').get(id)).toBeUndefined();
  });

  it('deletes a slot referenced only by an acabado appointment and nulls its reference', async () => {
    const id = insertTimeslot(testDb, { mechanicId: mechanic.id, isAvailable: 0 });
    const clientId = insertProfile(testDb, { role: 'client' });
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId: mechanic.id,
      timeslotId: id,
      status: 'acabado',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/timeslots/${id}`,
      headers: { authorization: `Bearer ${mechanic.token}` },
    });

    expect(res.statusCode).toBe(204);
    expect(
      testDb.connection.prepare('SELECT timeslot_id AS timeslotId FROM appointments WHERE id = ?').get(appointmentId),
    ).toEqual({ timeslotId: null });
  });

  it('returns TIMESLOT_NOT_FOUND to non-owning mechanics and clients', async () => {
    const id = insertTimeslot(testDb, { mechanicId: mechanic.id });
    const otherMechanic = makeMechanicToken(testDb);
    const clientToken = makeClientToken(testDb);

    for (const token of [otherMechanic.token, clientToken]) {
      const res = await app.inject({
        method: 'DELETE',
        url: `/timeslots/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'timeslot not found', code: 'TIMESLOT_NOT_FOUND' });
    }
  });
});
