import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import type { AppointmentStatus } from '../../src/db/schema.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

const validPayload = (email = `${randomUUID()}@example.com`) => ({
  name: 'Marina Costa',
  phone: '+5511999998888',
  email,
  password: 'mechanic-password',
  specialty: 'Injecao eletronica',
  credentials: 'CRT-12345',
});

describe('POST /admin/mechanics', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    const adminId = insertProfile(testDb, { role: 'admin' });
    adminToken = signAccessToken({ userId: adminId, role: 'admin' }).token;
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  async function create(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/admin/mechanics',
      headers: { authorization: `Bearer ${adminToken}` },
      payload,
    });
  }

  it('returns 201 and writes both profile and mechanic rows', async () => {
    const payload = validPayload('created@example.com');
    const response = await create(payload);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String),
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      avatarUrl: null,
      createdAt: expect.any(String),
      specialty: payload.specialty,
      credentials: payload.credentials,
      isActive: true,
    });

    const profile = testDb.connection
      .prepare('SELECT id, name, email, role, phone, password_hash AS passwordHash FROM profiles WHERE email = ?')
      .get(payload.email) as Record<string, unknown>;
    const mechanic = testDb.connection
      .prepare('SELECT id, specialty, credentials, is_active AS isActive FROM mechanics WHERE id = ?')
      .get(profile.id) as Record<string, unknown>;

    expect(profile).toMatchObject({ name: payload.name, email: payload.email, role: 'mechanic', phone: payload.phone });
    expect(profile.passwordHash).not.toBe(payload.password);
    expect(mechanic).toEqual({
      id: profile.id,
      specialty: payload.specialty,
      credentials: payload.credentials,
      isActive: 1,
    });
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM notifications').get()).toEqual({ count: 0 });
  });

  it('populates public_mechanics before the response returns', async () => {
    const payload = validPayload('public@example.com');
    const response = await create(payload);
    const id = response.json().id as string;

    expect(response.statusCode).toBe(201);
    expect(
      testDb.connection
        .prepare('SELECT id, name, specialty, avatar_url AS avatarUrl FROM public_mechanics WHERE id = ?')
        .get(id),
    ).toEqual({ id, name: payload.name, specialty: payload.specialty, avatarUrl: null });
  });

  it('creates credentials that work immediately through POST /auth/login', async () => {
    const payload = validPayload('login-created@example.com');
    const created = await create(payload);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: payload.email, password: payload.password },
    });

    expect(created.statusCode).toBe(201);
    expect(login.statusCode).toBe(200);
    expect(login.json().user).toMatchObject({ id: created.json().id, role: 'mechanic', specialty: payload.specialty });
  });

  it('returns 409 EMAIL_TAKEN and writes no additional profile for a duplicate email', async () => {
    const email = 'duplicate@example.com';
    insertProfile(testDb, { name: 'Existing User', email, role: 'client' });

    const response = await create({ ...validPayload(email), name: 'Rejected Mechanic' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'email already registered', code: 'EMAIL_TAKEN' });
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM profiles WHERE email = ?').get(email)).toEqual({
      count: 1,
    });
    expect(testDb.connection.prepare('SELECT id FROM profiles WHERE name = ?').get('Rejected Mechanic')).toBeUndefined();
  });

  it('returns 400 VALIDATION_FAILED for a seven-character password', async () => {
    const response = await create({ ...validPayload(), password: '1234567' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
  });

  it('returns 400 VALIDATION_FAILED when credentials is missing', async () => {
    const { credentials: _credentials, ...payload } = validPayload();
    const response = await create(payload);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
  });

  it('ignores isActive false and creates an active mechanic', async () => {
    const response = await create({ ...validPayload('forced-active@example.com'), isActive: false });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.isActive).toBe(true);
    expect(testDb.connection.prepare('SELECT is_active AS isActive FROM mechanics WHERE id = ?').get(body.id)).toEqual({
      isActive: 1,
    });
  });

  it('rolls back the profile when the mechanics insert fails', async () => {
    const email = 'rollback@example.com';
    testDb.connection.exec(`
      CREATE TRIGGER force_mechanics_insert_failure
      BEFORE INSERT ON mechanics
      WHEN NEW.specialty = 'Force rollback'
      BEGIN
        SELECT RAISE(ABORT, 'forced mechanics insert failure');
      END
    `);

    const response = await create({ ...validPayload(email), specialty: 'Force rollback' });

    expect(response.statusCode).toBe(500);
    expect(testDb.connection.prepare('SELECT id FROM profiles WHERE email = ?').get(email)).toBeUndefined();
    expect(testDb.connection.prepare('SELECT COUNT(*) AS count FROM mechanics').get()).toEqual({ count: 0 });
  });

  it.each([
    ['no token', undefined, 401, 'UNAUTHENTICATED'],
    [
      'client token',
      (testDb: TestDb) => {
        const id = insertProfile(testDb, { role: 'client' });
        return signAccessToken({ userId: id, role: 'client' }).token;
      },
      403,
      'FORBIDDEN',
    ],
    ['mechanic token', (testDb: TestDb) => makeMechanicToken(testDb).token, 403, 'FORBIDDEN'],
  ] as const)('rejects %s before creating a mechanic', async (_label, makeToken, status, code) => {
    const email = `${randomUUID()}@example.com`;
    const token = makeToken?.(testDb);
    const response = await app.inject({
      method: 'POST',
      url: '/admin/mechanics',
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      payload: validPayload(email),
    });

    expect(response.statusCode).toBe(status);
    expect(response.json().code).toBe(code);
    expect(testDb.connection.prepare('SELECT id FROM profiles WHERE email = ?').get(email)).toBeUndefined();
  });
});

function insertMechanicFixture(
  testDb: TestDb,
  overrides: { id: string; name: string; isActive?: boolean; specialty?: string },
) {
  const id = insertProfile(testDb, { id: overrides.id, name: overrides.name, role: 'mechanic' });
  testDb.connection
    .prepare('INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)')
    .run(id, overrides.specialty ?? 'Freios', 'ASE', overrides.isActive === false ? 0 : 1);
  return id;
}

function insertAppointmentFixture(
  testDb: TestDb,
  input: {
    id: string;
    clientId: string;
    mechanicId: string;
    date: string;
    status: AppointmentStatus;
    revenueCents?: number;
  },
) {
  testDb.connection
    .prepare(
      `INSERT INTO appointments (id, client_id, mechanic_id, date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, '09:00', '10:00', ?)`,
    )
    .run(input.id, input.clientId, input.mechanicId, input.date, input.status);

  if (input.revenueCents !== undefined) {
    testDb.connection
      .prepare(
        `INSERT INTO appointment_service_reports
         (appointment_id, mechanic_id, summary, work_performed, total_amount_cents)
         VALUES (?, ?, 'Servico concluido', 'Trabalho concluido', ?)`,
      )
      .run(input.id, input.mechanicId, input.revenueCents);
  }
}

describe('GET /admin/dashboard', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    const adminId = insertProfile(testDb, { role: 'admin' });
    adminToken = signAccessToken({ userId: adminId, role: 'admin' }).token;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  async function dashboard(query = '') {
    return app.inject({
      method: 'GET',
      url: `/admin/dashboard${query}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
  }

  it('returns the exact summary contract with the default Sao Paulo range and two mechanic keys', async () => {
    insertMechanicFixture(testDb, { id: 'active-mechanic', name: 'Active Mechanic' });
    insertMechanicFixture(testDb, { id: 'inactive-mechanic', name: 'Inactive Mechanic' });
    testDb.connection.prepare('UPDATE mechanics SET is_active = 0 WHERE id = ?').run('inactive-mechanic');

    const response = await dashboard();
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'appointments',
      'appointmentsByDay',
      'generatedAt',
      'mechanics',
      'range',
      'slots',
      'topMechanics',
    ]);
    expect(body.range).toEqual({ from: '2026-08-01', to: '2026-08-15' });
    expect(body.generatedAt).toBe('2026-08-15T15:00:00.000Z');
    expect(body.mechanics).toEqual({ total: 2, active: 1 });
    expect(Object.keys(body.appointments).sort()).toEqual([
      'canceled',
      'confirmed',
      'finished',
      'revenueCents',
      'today',
      'total',
      'unfinished',
    ]);
    expect(body.slots).toEqual({ upcomingAvailable: 0, upcomingBlocked: 0 });
    expect(body.appointmentsByDay).toHaveLength(15);
    expect(Object.keys(body.appointmentsByDay[0]).sort()).toEqual([
      'canceled',
      'confirmed',
      'date',
      'finished',
      'revenueCents',
      'total',
      'unfinished',
    ]);
    expect(body.topMechanics).toEqual([]);
  });

  it('breaks appointments down by stored status, gap-fills quiet days, counts slots, and uses report revenue', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'summary-mechanic', name: 'Summary Mechanic' });
    const clientId = insertProfile(testDb, { id: 'summary-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'unfinished', clientId, mechanicId, date: '2026-08-12', status: 'nao_finalizado',
    });
    insertAppointmentFixture(testDb, {
      id: 'finished', clientId, mechanicId, date: '2026-08-13', status: 'acabado', revenueCents: 7777,
    });
    insertAppointmentFixture(testDb, {
      id: 'confirmed', clientId, mechanicId, date: '2026-08-15', status: 'confirmado',
    });
    insertAppointmentFixture(testDb, {
      id: 'canceled', clientId, mechanicId, date: '2026-08-15', status: 'cancelado',
    });
    testDb.connection
      .prepare(
        `INSERT INTO timeslots (id, mechanic_id, date, start_time, end_time, is_available)
         VALUES ('past', ?, '2026-08-14', '08:00', '09:00', 1),
                ('available', ?, '2026-08-15', '10:00', '11:00', 1),
                ('blocked', ?, '2026-08-16', '11:00', '12:00', 0)`,
      )
      .run(mechanicId, mechanicId, mechanicId);

    const response = await dashboard('?from=2026-08-12&to=2026-08-15');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.appointments).toEqual({
      total: 4,
      confirmed: 1,
      unfinished: 1,
      finished: 1,
      canceled: 1,
      today: 2,
      revenueCents: 7777,
    });
    expect(body.slots).toEqual({ upcomingAvailable: 1, upcomingBlocked: 1 });
    expect(body.appointmentsByDay.find((day: { date: string }) => day.date === '2026-08-13').revenueCents).toBe(7777);
    expect(body.appointmentsByDay.find((day: { date: string }) => day.date === '2026-08-14')).toEqual({
      date: '2026-08-14',
      total: 0,
      confirmed: 0,
      unfinished: 0,
      finished: 0,
      canceled: 0,
      revenueCents: 0,
    });
  });

  it('returns exactly one per-day point for a single-day range', async () => {
    const response = await dashboard('?from=2026-08-14&to=2026-08-14');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      range: { from: '2026-08-14', to: '2026-08-14' },
      generatedAt: '2026-08-15T15:00:00.000Z',
      mechanics: { total: 0, active: 0 },
      appointments: {
        total: 0,
        confirmed: 0,
        unfinished: 0,
        finished: 0,
        canceled: 0,
        today: 0,
        revenueCents: 0,
      },
      slots: { upcomingAvailable: 0, upcomingBlocked: 0 },
      appointmentsByDay: [
        {
          date: '2026-08-14',
          total: 0,
          confirmed: 0,
          unfinished: 0,
          finished: 0,
          canceled: 0,
          revenueCents: 0,
        },
      ],
      topMechanics: [],
    });
  });

  it('synchronizes a stale confirmed appointment before aggregating it', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'stale-mechanic', name: 'Stale Mechanic' });
    const clientId = insertProfile(testDb, { id: 'stale-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'stale-appointment', clientId, mechanicId, date: '2026-08-14', status: 'confirmado',
    });

    const response = await dashboard('?from=2026-08-14&to=2026-08-14');

    expect(response.statusCode).toBe(200);
    expect(response.json().appointments).toMatchObject({ total: 1, confirmed: 0, unfinished: 1 });
    expect(testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('stale-appointment')).toEqual({
      status: 'nao_finalizado',
    });
  });

  it('caps top mechanics at five and orders revenue, appointment count, then name across genuine ties', async () => {
    const clientId = insertProfile(testDb, { id: 'ranking-client', role: 'client' });
    const fixtures = [
      { id: 'alpha', name: 'Alpha', revenues: [5000, 0], isActive: false },
      { id: 'bravo', name: 'Bravo', revenues: [5000, 0] },
      { id: 'charlie', name: 'Charlie', revenues: [5000, 0, 0] },
      { id: 'delta', name: 'Delta', revenues: [4000] },
      { id: 'echo', name: 'Echo', revenues: [3000] },
      { id: 'foxtrot', name: 'Foxtrot', revenues: [3000] },
    ];

    for (const fixture of fixtures) {
      const mechanicId = insertMechanicFixture(testDb, fixture);
      fixture.revenues.forEach((revenueCents, index) => {
        insertAppointmentFixture(testDb, {
          id: `${fixture.id}-${index}`,
          clientId,
          mechanicId,
          date: '2026-08-15',
          status: 'acabado',
          revenueCents,
        });
      });
    }

    const response = await dashboard('?from=2026-08-15&to=2026-08-15');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.topMechanics).toHaveLength(5);
    expect(body.topMechanics.map((row: { mechanicId: string }) => row.mechanicId)).toEqual([
      'charlie',
      'alpha',
      'bravo',
      'delta',
      'echo',
    ]);
    expect(body.topMechanics[0]).toMatchObject({ appointments: 3, revenueCents: 5000 });
    expect(body.topMechanics[1]).toEqual({
      mechanicId: 'alpha',
      mechanicName: 'Alpha',
      specialty: 'Freios',
      appointments: 2,
      revenueCents: 5000,
    });
  });

  it('returns INVALID_DATE_RANGE when from is later than to', async () => {
    const response = await dashboard('?from=2026-08-16&to=2026-08-15');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid date range', code: 'INVALID_DATE_RANGE' });
  });

  it('rejects a non-admin token', async () => {
    const clientId = insertProfile(testDb, { id: 'dashboard-client', role: 'client' });
    const clientToken = signAccessToken({ userId: clientId, role: 'client' }).token;
    const response = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});
