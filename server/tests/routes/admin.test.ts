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
  overrides: {
    id: string;
    name: string;
    email?: string;
    phone?: string | null;
    isActive?: boolean;
    specialty?: string;
    credentials?: string;
  },
) {
  const id = insertProfile(testDb, {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email,
    phone: overrides.phone,
    role: 'mechanic',
  });
  testDb.connection
    .prepare('INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)')
    .run(
      id,
      overrides.specialty ?? 'Freios',
      overrides.credentials ?? 'ASE',
      overrides.isActive === false ? 0 : 1,
    );
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
    startTime?: string;
    endTime?: string;
    timeslotId?: string;
    vehicleInfo?: string;
    notes?: string;
  },
) {
  testDb.connection
    .prepare(
      `INSERT INTO appointments
       (id, client_id, mechanic_id, timeslot_id, date, start_time, end_time, status, vehicle_info, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.clientId,
      input.mechanicId,
      input.timeslotId ?? null,
      input.date,
      input.startTime ?? '09:00',
      input.endTime ?? '10:00',
      input.status,
      input.vehicleInfo ?? null,
      input.notes ?? null,
    );

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

function insertServiceItemFixture(
  testDb: TestDb,
  input: { id: string; appointmentId: string; description: string; amountCents: number; sortOrder?: number },
) {
  testDb.connection
    .prepare(
      `INSERT INTO appointment_service_items (id, appointment_id, description, amount_cents, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.id, input.appointmentId, input.description, input.amountCents, input.sortOrder ?? 0);
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

describe('GET /admin/mechanics and GET /admin/mechanics/:id', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    const adminId = insertProfile(testDb, { id: 'admin-reader', role: 'admin' });
    adminToken = signAccessToken({ userId: adminId, role: 'admin' }).token;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  function get(url: string, token = adminToken) {
    return app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it('returns the exact paginated mechanic row contract with appointment aggregates', async () => {
    const mechanicId = insertMechanicFixture(testDb, {
      id: 'aggregate-mechanic',
      name: 'Ana Aggregate',
      email: 'ana@example.com',
      phone: '+5511999999999',
      specialty: 'Motor',
      credentials: 'CRT-9',
    });
    const clientId = insertProfile(testDb, { id: 'aggregate-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'aggregate-confirmed', clientId, mechanicId, date: '2026-08-15', status: 'confirmado',
    });
    insertAppointmentFixture(testDb, {
      id: 'aggregate-finished', clientId, mechanicId, date: '2026-08-10', status: 'acabado',
    });

    const response = await get('/admin/mechanics');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['page', 'pageSize', 'rows', 'total']);
    expect(body).toEqual({
      rows: [
        {
          id: mechanicId,
          name: 'Ana Aggregate',
          email: 'ana@example.com',
          phone: '+5511999999999',
          avatarUrl: null,
          createdAt: expect.any(String),
          specialty: 'Motor',
          credentials: 'CRT-9',
          isActive: true,
          appointmentsTotal: 2,
          appointmentsConfirmed: 1,
          lastAppointmentDate: '2026-08-15',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('searches name and email substrings case-insensitively', async () => {
    insertMechanicFixture(testDb, {
      id: 'name-match', name: 'Marina Costa', email: 'other@example.com',
    });
    insertMechanicFixture(testDb, {
      id: 'email-match', name: 'Different Person', email: 'garage.target@example.com',
    });

    const nameResponse = await get('/admin/mechanics?search=RINA');
    const emailResponse = await get('/admin/mechanics?search=TARGET');

    expect(nameResponse.json().rows.map((row: { id: string }) => row.id)).toEqual(['name-match']);
    expect(emailResponse.json().rows.map((row: { id: string }) => row.id)).toEqual(['email-match']);
  });

  it('matches percent, underscore, and backslash in search literally instead of as LIKE wildcards', async () => {
    insertMechanicFixture(testDb, {
      id: 'literal-match', name: 'Oferta 50%_\\Especial', email: 'literal@example.com',
    });
    insertMechanicFixture(testDb, {
      id: 'wildcard-lookalike', name: 'Oferta 50XXEspecial', email: 'lookalike@example.com',
    });

    const response = await get(`/admin/mechanics?search=${encodeURIComponent('50%_\\')}`);

    expect(response.json().rows.map((row: { id: string }) => row.id)).toEqual(['literal-match']);
  });

  it('documents the current accent-folding gap', async () => {
    insertMechanicFixture(testDb, { id: 'accented', name: 'José Almeida' });

    const response = await get('/admin/mechanics?search=jose');

    expect(response.json()).toMatchObject({ rows: [], total: 0 });
  });

  it('caps pageSize at 100', async () => {
    const response = await get('/admin/mechanics?pageSize=500');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 1, pageSize: 100 });
  });

  it('paginates without overlap and page union equals the full ordered set', async () => {
    insertMechanicFixture(testDb, { id: 'delta', name: 'Delta' });
    insertMechanicFixture(testDb, { id: 'alpha', name: 'Alpha' });
    insertMechanicFixture(testDb, { id: 'charlie', name: 'Charlie' });
    insertMechanicFixture(testDb, { id: 'bravo', name: 'Bravo' });

    const page1 = (await get('/admin/mechanics?page=1&pageSize=2')).json();
    const page2 = (await get('/admin/mechanics?page=2&pageSize=2')).json();
    const ids1 = page1.rows.map((row: { id: string }) => row.id);
    const ids2 = page2.rows.map((row: { id: string }) => row.id);

    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    expect([...ids1, ...ids2]).toEqual(['alpha', 'bravo', 'charlie', 'delta']);
    expect(page1.total).toBe(4);
    expect(page2.total).toBe(4);
  });

  it('orders same-named mechanics stably by id', async () => {
    insertMechanicFixture(testDb, { id: 'same-z', name: 'Same Name' });
    insertMechanicFixture(testDb, { id: 'same-a', name: 'Same Name' });

    const response = await get('/admin/mechanics');

    expect(response.json().rows.map((row: { id: string }) => row.id)).toEqual(['same-a', 'same-z']);
  });

  it('returns detail stats, upcoming slot usage, full appointment rows, and deterministic recent ordering', async () => {
    const mechanicId = insertMechanicFixture(testDb, {
      id: 'detail-mechanic',
      name: 'Detail Mechanic',
      phone: '+5511888888888',
      specialty: 'Suspensao',
    });
    const clientId = insertProfile(testDb, {
      id: 'detail-client', name: 'Detail Client', phone: '+5511777777777', role: 'client',
    });
    testDb.connection
      .prepare(
        `INSERT INTO timeslots (id, mechanic_id, date, start_time, end_time, is_available)
         VALUES ('past-slot', ?, '2026-08-14', '08:00', '09:00', 1),
                ('open-slot', ?, '2026-08-15', '10:00', '11:00', 1),
                ('blocked-slot', ?, '2026-08-16', '11:00', '12:00', 0)`,
      )
      .run(mechanicId, mechanicId, mechanicId);
    insertAppointmentFixture(testDb, {
      id: 'tie-z', clientId, mechanicId, date: '2026-08-15', startTime: '11:00', endTime: '12:00',
      status: 'confirmado', vehicleInfo: 'Sedan', notes: 'Check noise',
    });
    insertAppointmentFixture(testDb, {
      id: 'tie-a', clientId, mechanicId, date: '2026-08-15', startTime: '11:00', endTime: '12:00',
      status: 'cancelado',
    });
    insertAppointmentFixture(testDb, {
      id: 'finished', clientId, mechanicId, date: '2026-08-14', startTime: '15:00', endTime: '16:00',
      status: 'acabado', revenueCents: 12345,
    });
    insertAppointmentFixture(testDb, {
      id: 'outside-range', clientId, mechanicId, date: '2026-08-01', status: 'acabado',
    });
    testDb.connection
      .prepare(
        `UPDATE appointment_service_reports
         SET diagnosis = 'Bearing', parts_used = 'Hub', recommendations = 'Return soon'
         WHERE appointment_id = 'finished'`,
      )
      .run();
    testDb.connection
      .prepare(
        `INSERT INTO appointment_service_items (id, appointment_id, description, amount_cents, sort_order)
         VALUES ('service-item', 'finished', 'Wheel bearing', 12345, 0)`,
      )
      .run();

    const response = await get('/admin/mechanics/detail-mechanic?from=2026-08-14&to=2026-08-15');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'appointmentStats', 'mechanic', 'range', 'recentAppointments', 'slotStats',
    ]);
    expect(body.range).toEqual({ from: '2026-08-14', to: '2026-08-15' });
    expect(body.appointmentStats).toEqual({ total: 3, confirmed: 1, unfinished: 0, finished: 1, canceled: 1 });
    expect(body.slotStats).toEqual({ totalUpcoming: 2, availableUpcoming: 1 });
    expect(body.recentAppointments.map((row: { id: string }) => row.id)).toEqual(['tie-z', 'tie-a', 'finished']);
    expect(Object.keys(body.recentAppointments[0]).sort()).toEqual([
      'clientId', 'clientName', 'clientPhone', 'closedAt', 'createdAt', 'date', 'endTime', 'id', 'mechanicId',
      'mechanicName', 'mechanicPhone', 'notes', 'partsUsed', 'recommendations', 'serviceDiagnosis', 'serviceItems',
      'serviceSummary', 'specialty', 'startTime', 'status', 'timeSlotId', 'totalAmountCents', 'vehicleInfo',
      'workPerformed',
    ]);
    expect(body.recentAppointments.find((row: { id: string }) => row.id === 'finished')).toMatchObject({
      clientId,
      clientName: 'Detail Client',
      clientPhone: '+5511777777777',
      mechanicId,
      mechanicName: 'Detail Mechanic',
      mechanicPhone: '+5511888888888',
      specialty: 'Suspensao',
      serviceSummary: 'Servico concluido',
      serviceDiagnosis: 'Bearing',
      workPerformed: 'Trabalho concluido',
      partsUsed: 'Hub',
      recommendations: 'Return soon',
      totalAmountCents: 12345,
      serviceItems: [{ id: 'service-item', description: 'Wheel bearing', amountCents: 12345, sortOrder: 0 }],
    });
  });

  it('synchronizes stale confirmed appointments independently before list and detail reads', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'stale-reader', name: 'Stale Reader' });
    const clientId = insertProfile(testDb, { id: 'stale-reader-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'stale-for-list', clientId, mechanicId, date: '2026-08-14', status: 'confirmado',
    });

    const listResponse = await get('/admin/mechanics?search=Stale%20Reader');

    expect(listResponse.json().rows[0]).toMatchObject({ appointmentsTotal: 1, appointmentsConfirmed: 0 });
    expect(testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('stale-for-list')).toEqual({
      status: 'nao_finalizado',
    });

    insertAppointmentFixture(testDb, {
      id: 'stale-for-detail', clientId, mechanicId, date: '2026-08-14', status: 'confirmado',
    });
    const detailResponse = await get('/admin/mechanics/stale-reader?from=2026-08-14&to=2026-08-14');

    expect(detailResponse.json().appointmentStats).toMatchObject({ total: 2, confirmed: 0, unfinished: 2 });
    expect(testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('stale-for-detail')).toEqual({
      status: 'nao_finalizado',
    });
  });

  it('keeps a deactivated mechanic visible and openable', async () => {
    insertMechanicFixture(testDb, { id: 'inactive-reader', name: 'Inactive Reader', isActive: false });

    const listResponse = await get('/admin/mechanics');
    const detailResponse = await get('/admin/mechanics/inactive-reader');

    expect(listResponse.json().rows).toHaveLength(1);
    expect(listResponse.json().rows[0]).toMatchObject({ id: 'inactive-reader', isActive: false });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().mechanic).toMatchObject({ id: 'inactive-reader', isActive: false });
  });

  it('returns MECHANIC_NOT_FOUND for an unknown free-form id', async () => {
    const response = await get('/admin/mechanics/not-a-uuid');

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'mechanic not found', code: 'MECHANIC_NOT_FOUND' });
  });

  it('returns INVALID_DATE_RANGE on detail when from is later than to', async () => {
    insertMechanicFixture(testDb, { id: 'range-mechanic', name: 'Range Mechanic' });

    const response = await get('/admin/mechanics/range-mechanic?from=2026-08-16&to=2026-08-15');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid date range', code: 'INVALID_DATE_RANGE' });
  });

  it.each(['/admin/mechanics', '/admin/mechanics/any-id'])('rejects non-admin access to %s', async (url) => {
    const clientId = insertProfile(testDb, { id: `client-${url.length}`, role: 'client' });
    const clientToken = signAccessToken({ userId: clientId, role: 'client' }).token;

    const response = await get(url, clientToken);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});

describe('GET /admin/appointments', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-15T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    const adminId = insertProfile(testDb, { id: 'appointment-admin', role: 'admin' });
    adminToken = signAccessToken({ userId: adminId, role: 'admin' }).token;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  function get(url: string, token = adminToken) {
    return app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it('returns the exact paginated appointment contract with counterparties, report fields, and service items', async () => {
    const mechanicId = insertMechanicFixture(testDb, {
      id: 'inactive-contract-mechanic',
      name: 'Marcos Contract',
      phone: '+5511888888888',
      specialty: 'Cambio',
      isActive: false,
    });
    const clientId = insertProfile(testDb, {
      id: 'contract-client',
      name: 'Carla Contract',
      phone: '+5511777777777',
      role: 'client',
    });
    insertAppointmentFixture(testDb, {
      id: 'contract-appointment',
      clientId,
      mechanicId,
      date: '2026-08-15',
      startTime: '13:00',
      endTime: '14:00',
      status: 'acabado',
      revenueCents: 23456,
      vehicleInfo: 'Honda Civic 2020',
      notes: 'Vibracao em alta velocidade',
    });
    testDb.connection
      .prepare(
        `UPDATE appointment_service_reports
         SET diagnosis = 'Rolamento gasto', parts_used = 'Rolamento', recommendations = 'Revisar em 30 dias'
         WHERE appointment_id = 'contract-appointment'`,
      )
      .run();
    testDb.connection
      .prepare(
        `INSERT INTO appointment_service_items (id, appointment_id, description, amount_cents, sort_order)
         VALUES ('item-later', 'contract-appointment', 'Mao de obra', 10000, 1),
                ('item-first', 'contract-appointment', 'Rolamento', 13456, 0)`,
      )
      .run();

    const response = await get('/admin/appointments?from=2026-08-15&to=2026-08-15');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['page', 'pageSize', 'rows', 'total']);
    expect(Object.keys(body.rows[0]).sort()).toEqual([
      'clientId', 'clientName', 'clientPhone', 'closedAt', 'createdAt', 'date', 'endTime', 'id', 'mechanicId',
      'mechanicName', 'mechanicPhone', 'notes', 'partsUsed', 'recommendations', 'serviceDiagnosis', 'serviceItems',
      'serviceSummary', 'specialty', 'startTime', 'status', 'timeSlotId', 'totalAmountCents', 'vehicleInfo',
      'workPerformed',
    ]);
    expect(body).toEqual({
      rows: [
        {
          id: 'contract-appointment',
          clientId,
          clientName: 'Carla Contract',
          clientPhone: '+5511777777777',
          mechanicId,
          mechanicName: 'Marcos Contract',
          mechanicPhone: '+5511888888888',
          specialty: 'Cambio',
          timeSlotId: null,
          date: '2026-08-15',
          startTime: '13:00',
          endTime: '14:00',
          status: 'acabado',
          vehicleInfo: 'Honda Civic 2020',
          notes: 'Vibracao em alta velocidade',
          serviceSummary: 'Servico concluido',
          serviceDiagnosis: 'Rolamento gasto',
          workPerformed: 'Trabalho concluido',
          partsUsed: 'Rolamento',
          recommendations: 'Revisar em 30 dias',
          totalAmountCents: 23456,
          closedAt: expect.any(String),
          serviceItems: [
            { id: 'item-first', description: 'Rolamento', amountCents: 13456, sortOrder: 0 },
            { id: 'item-later', description: 'Mao de obra', amountCents: 10000, sortOrder: 1 },
          ],
          createdAt: expect.any(String),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('composes status and opaque mechanic filters', async () => {
    const seedMechanicId = insertMechanicFixture(testDb, { id: 'seed-mechanic-1', name: 'Seed Mechanic' });
    const otherMechanicId = insertMechanicFixture(testDb, { id: 'other-mechanic', name: 'Other Mechanic' });
    const clientId = insertProfile(testDb, { id: 'filter-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'seed-canceled', clientId, mechanicId: seedMechanicId, date: '2026-08-15', status: 'cancelado',
    });
    insertAppointmentFixture(testDb, {
      id: 'seed-finished', clientId, mechanicId: seedMechanicId, date: '2026-08-15', status: 'acabado',
    });
    insertAppointmentFixture(testDb, {
      id: 'other-canceled', clientId, mechanicId: otherMechanicId, date: '2026-08-15', status: 'cancelado',
    });

    const response = await get(
      '/admin/appointments?from=2026-08-15&to=2026-08-15&status=cancelado&mechanicId=seed-mechanic-1',
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 1 });
    expect(response.json().rows.map((row: { id: string }) => row.id)).toEqual(['seed-canceled']);
  });

  it('searches appointment fields case-insensitively and treats LIKE wildcards literally', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'search-mechanic', name: 'Marina 50%_Especial' });
    const otherMechanicId = insertMechanicFixture(testDb, { id: 'search-lookalike', name: 'Marina 50XXEspecial' });
    const clientId = insertProfile(testDb, { id: 'search-client', name: 'Cliente Alvo', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'literal-search-match', clientId, mechanicId, date: '2026-08-15', status: 'acabado', revenueCents: 100,
    });
    insertAppointmentFixture(testDb, {
      id: 'search-lookalike-row', clientId, mechanicId: otherMechanicId, date: '2026-08-15', status: 'acabado',
    });

    const nameResponse = await get('/admin/appointments?from=2026-08-15&to=2026-08-15&search=CLIENTE%20ALVO');
    const literalResponse = await get(
      `/admin/appointments?from=2026-08-15&to=2026-08-15&search=${encodeURIComponent('50%_')}`,
    );

    expect(nameResponse.json().total).toBe(2);
    expect(literalResponse.json().rows.map((row: { id: string }) => row.id)).toEqual(['literal-search-match']);
  });

  it('orders by date, start time, and id descending across genuine ties', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'order-mechanic', name: 'Order Mechanic' });
    const clientId = insertProfile(testDb, { id: 'order-client', role: 'client' });
    const fixtures = [
      { id: 'older-date', date: '2026-08-14', startTime: '16:00' },
      { id: 'earlier-time', date: '2026-08-15', startTime: '09:00' },
      { id: 'tie-a', date: '2026-08-15', startTime: '11:00' },
      { id: 'tie-z', date: '2026-08-15', startTime: '11:00' },
    ];
    for (const fixture of fixtures) {
      insertAppointmentFixture(testDb, {
        ...fixture,
        clientId,
        mechanicId,
        endTime: fixture.startTime === '16:00' ? '17:00' : fixture.startTime === '11:00' ? '12:00' : '10:00',
        status: 'acabado',
      });
    }

    const response = await get('/admin/appointments?from=2026-08-14&to=2026-08-15');

    expect(response.json().rows.map((row: { id: string }) => row.id)).toEqual([
      'tie-z',
      'tie-a',
      'earlier-time',
      'older-date',
    ]);
  });

  it('paginates without overlap and page union equals the full ordered set', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'page-mechanic', name: 'Page Mechanic' });
    const clientId = insertProfile(testDb, { id: 'page-client', role: 'client' });
    for (const id of ['page-a', 'page-b', 'page-c', 'page-d']) {
      insertAppointmentFixture(testDb, {
        id, clientId, mechanicId, date: '2026-08-15', startTime: '10:00', endTime: '11:00', status: 'acabado',
      });
    }

    const page1 = (await get('/admin/appointments?from=2026-08-15&to=2026-08-15&page=1&pageSize=2')).json();
    const page2 = (await get('/admin/appointments?from=2026-08-15&to=2026-08-15&page=2&pageSize=2')).json();
    const ids1 = page1.rows.map((row: { id: string }) => row.id);
    const ids2 = page2.rows.map((row: { id: string }) => row.id);

    expect(ids1.filter((id: string) => ids2.includes(id))).toEqual([]);
    expect([...ids1, ...ids2]).toEqual(['page-d', 'page-c', 'page-b', 'page-a']);
    expect(page1.total).toBe(4);
    expect(page2.total).toBe(4);
  });

  it('caps pageSize at 100', async () => {
    const response = await get('/admin/appointments?pageSize=500');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 1, pageSize: 100 });
  });

  it('synchronizes a stale confirmed row before selecting it', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'sync-mechanic', name: 'Sync Mechanic' });
    const clientId = insertProfile(testDb, { id: 'sync-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'stale-list-row', clientId, mechanicId, date: '2026-08-14', status: 'confirmado',
    });
    const storedBefore = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('stale-list-row');

    const response = await get('/admin/appointments?from=2026-08-14&to=2026-08-14');
    const storedAfter = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('stale-list-row');

    expect(storedBefore).toEqual({ status: 'confirmado' });
    expect(response.json().rows[0]).toMatchObject({ id: 'stale-list-row', status: 'nao_finalizado' });
    expect(storedAfter).toEqual({ status: 'nao_finalizado' });
  });

  it('returns INVALID_DATE_RANGE when from is later than to', async () => {
    const response = await get('/admin/appointments?from=2026-08-16&to=2026-08-15');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid date range', code: 'INVALID_DATE_RANGE' });
  });

  it('rejects a non-admin token', async () => {
    const clientId = insertProfile(testDb, { id: 'appointment-reader-client', role: 'client' });
    const clientToken = signAccessToken({ userId: clientId, role: 'client' }).token;

    const response = await get('/admin/appointments', clientToken);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});

describe('GET /admin/finance', () => {
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

  async function get(query = '', token = adminToken) {
    return app.inject({
      method: 'GET',
      url: `/admin/finance${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it('returns the exact populated contract using report revenue, gap filling, and total ordering', async () => {
    const clientId = insertProfile(testDb, { id: 'finance-client', name: 'Cliente Financeiro', role: 'client' });
    const zetaId = insertMechanicFixture(testDb, {
      id: 'finance-zeta', name: 'Zeta', specialty: 'Suspensao', isActive: false,
    });
    const alphaId = insertMechanicFixture(testDb, {
      id: 'finance-alpha', name: 'Alpha', specialty: 'Eletrica',
    });
    const highId = insertMechanicFixture(testDb, {
      id: 'finance-high', name: 'High', specialty: 'Freios',
    });
    insertAppointmentFixture(testDb, {
      id: 'zeta-appointment', clientId, mechanicId: zetaId, date: '2026-08-14', status: 'acabado',
      revenueCents: 30000, vehicleInfo: 'Sedan Z',
    });
    insertAppointmentFixture(testDb, {
      id: 'alpha-appointment', clientId, mechanicId: alphaId, date: '2026-08-14', status: 'acabado',
      revenueCents: 30000, vehicleInfo: 'Sedan A',
    });
    insertAppointmentFixture(testDb, {
      id: 'high-appointment', clientId, mechanicId: highId, date: '2026-08-12', status: 'acabado',
      revenueCents: 50000, vehicleInfo: 'SUV H',
    });
    testDb.connection
      .prepare("UPDATE appointment_service_reports SET closed_at = '2026-08-14T18:00:00.000Z'")
      .run();
    insertServiceItemFixture(testDb, {
      id: 'zeta-item', appointmentId: 'zeta-appointment', description: 'Zeta service', amountCents: 3,
    });
    insertServiceItemFixture(testDb, {
      id: 'alpha-item', appointmentId: 'alpha-appointment', description: 'Alpha service', amountCents: 2,
    });
    insertServiceItemFixture(testDb, {
      id: 'high-item', appointmentId: 'high-appointment', description: 'Brake service', amountCents: 1,
    });

    const response = await get('?from=2026-08-12&to=2026-08-14');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual([
      'appointments', 'byMechanic', 'byService', 'generatedAt', 'range', 'revenueByDay', 'revenueByMonth', 'summary',
    ]);
    expect(body.range).toEqual({ from: '2026-08-12', to: '2026-08-14' });
    expect(body.generatedAt).toBe('2026-08-15T15:00:00.000Z');
    expect(body.summary).toEqual({ appointments: 3, revenueCents: 110000, averageTicketCents: 36666 });
    expect(body.revenueByDay).toEqual([
      { date: '2026-08-12', appointments: 1, revenueCents: 50000 },
      { date: '2026-08-13', appointments: 0, revenueCents: 0 },
      { date: '2026-08-14', appointments: 2, revenueCents: 60000 },
    ]);
    expect(body.revenueByMonth).toEqual([{ month: '2026-08', appointments: 3, revenueCents: 110000 }]);
    expect(body.byMechanic).toEqual([
      { mechanicId: highId, mechanicName: 'High', specialty: 'Freios', appointments: 1, revenueCents: 50000 },
      { mechanicId: alphaId, mechanicName: 'Alpha', specialty: 'Eletrica', appointments: 1, revenueCents: 30000 },
      { mechanicId: zetaId, mechanicName: 'Zeta', specialty: 'Suspensao', appointments: 1, revenueCents: 30000 },
    ]);
    expect(body.byService).toEqual([
      { description: 'Brake service', quantity: 1, revenueCents: 50000 },
      { description: 'Alpha service', quantity: 1, revenueCents: 30000 },
      { description: 'Zeta service', quantity: 1, revenueCents: 30000 },
    ]);
    expect(body.appointments.map((row: { id: string }) => row.id)).toEqual([
      'zeta-appointment', 'alpha-appointment', 'high-appointment',
    ]);
    expect(Object.keys(body.appointments[0]).sort()).toEqual([
      'clientName', 'closedAt', 'date', 'id', 'mechanicName', 'serviceSummary', 'totalAmountCents', 'vehicleInfo',
    ]);
    expect(testDb.connection.prepare('SELECT is_active AS isActive FROM mechanics WHERE id = ?').get(zetaId)).toEqual({
      isActive: 0,
    });
  });

  it('uses the current Sao Paulo month by default and splits an explicit cross-month range', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'month-mechanic', name: 'Month Mechanic' });
    const clientId = insertProfile(testDb, { id: 'month-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'previous-month', clientId, mechanicId, date: '2026-07-31', status: 'acabado', revenueCents: 45000,
    });
    insertAppointmentFixture(testDb, {
      id: 'current-month', clientId, mechanicId, date: '2026-08-15', status: 'acabado', revenueCents: 15000,
    });

    const defaultResponse = await get();
    const explicitResponse = await get('?from=2026-07-31&to=2026-08-15');

    expect(defaultResponse.json()).toMatchObject({
      range: { from: '2026-08-01', to: '2026-08-15' },
      summary: { appointments: 1, revenueCents: 15000, averageTicketCents: 15000 },
    });
    expect(explicitResponse.json().revenueByMonth).toEqual([
      { month: '2026-07', appointments: 1, revenueCents: 45000 },
      { month: '2026-08', appointments: 1, revenueCents: 15000 },
    ]);
  });

  it('applies opaque mechanic and escaped search filters independently to every aggregate', async () => {
    const targetId = insertMechanicFixture(testDb, {
      id: 'seed-mechanic-1', name: 'Target Mechanic', phone: '+551150%_1234',
    });
    const otherId = insertMechanicFixture(testDb, { id: 'other-mechanic', name: 'Other Mechanic' });
    const clientId = insertProfile(testDb, { id: 'filter-client', name: 'Filter Client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'target-report', clientId, mechanicId: targetId, date: '2026-08-15', status: 'acabado', revenueCents: 12000,
    });
    insertAppointmentFixture(testDb, {
      id: 'other-report', clientId, mechanicId: otherId, date: '2026-08-15', status: 'acabado', revenueCents: 34000,
    });

    const mechanicBody = (await get('?mechanicId=seed-mechanic-1')).json();
    const searchBody = (await get(`?search=${encodeURIComponent('50%_')}`)).json();

    expect(mechanicBody.summary).toEqual({ appointments: 1, revenueCents: 12000, averageTicketCents: 12000 });
    expect(mechanicBody.appointments.map((row: { id: string }) => row.id)).toEqual(['target-report']);
    expect(searchBody.summary).toEqual({ appointments: 1, revenueCents: 12000, averageTicketCents: 12000 });
    expect(searchBody.byMechanic.map((row: { mechanicId: string }) => row.mechanicId)).toEqual(['seed-mechanic-1']);
  });

  it('synchronizes stale confirmed appointments before computing the report', async () => {
    const mechanicId = insertMechanicFixture(testDb, { id: 'finance-stale-mechanic', name: 'Stale Mechanic' });
    const clientId = insertProfile(testDb, { id: 'finance-stale-client', role: 'client' });
    insertAppointmentFixture(testDb, {
      id: 'finance-stale', clientId, mechanicId, date: '2026-08-14', status: 'confirmado',
    });

    const response = await get('?from=2026-08-14&to=2026-08-14');

    expect(response.statusCode).toBe(200);
    expect(response.json().summary).toEqual({ appointments: 0, revenueCents: 0, averageTicketCents: 0 });
    expect(testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get('finance-stale')).toEqual({
      status: 'nao_finalizado',
    });
  });

  it('returns INVALID_DATE_RANGE when from is later than to', async () => {
    const response = await get('?from=2026-08-16&to=2026-08-15');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid date range', code: 'INVALID_DATE_RANGE' });
  });

  it('rejects a non-admin token', async () => {
    const clientId = insertProfile(testDb, { id: 'finance-reader-client', role: 'client' });
    const clientToken = signAccessToken({ userId: clientId, role: 'client' }).token;

    const response = await get('', clientToken);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});
