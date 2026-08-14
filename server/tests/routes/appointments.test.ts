import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { makeTestDb } from '../helpers/db.js';
import {
  insertAppointment,
  insertMechanic,
  insertTimeslot,
  makeUserToken,
} from '../helpers/appointments.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function notificationRows(testDb: TestDb) {
  return testDb.connection
    .prepare('SELECT recipient_id, appointment_id, type, title, body FROM notifications ORDER BY created_at')
    .all();
}

function makeAdminToken(testDb: TestDb) {
  const id = insertProfile(testDb, { role: 'admin' });
  const token = signAccessToken({ userId: id, role: 'admin' }).token;
  return { id, token };
}

function insertServiceReportItems(
  testDb: TestDb,
  appointmentId: string,
  mechanicId: string,
  items: Array<{ id: string; description: string; amountCents: number; sortOrder: number }>,
) {
  testDb.connection
    .prepare(
      `INSERT INTO appointment_service_reports
         (appointment_id, mechanic_id, summary, work_performed, total_amount_cents)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      appointmentId,
      mechanicId,
      'Revisao concluida',
      'Servico executado',
      items.reduce((total, item) => total + item.amountCents, 0),
    );

  const statement = testDb.connection.prepare(
    `INSERT INTO appointment_service_items (id, appointment_id, description, amount_cents, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const item of items) {
    statement.run(item.id, appointmentId, item.description, item.amountCents, item.sortOrder);
  }
}

describe('GET /appointments', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let clientId: string;
  let clientToken: string;
  let mechanicId: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    ({ id: clientId, token: clientToken } = makeUserToken(testDb, 'client'));
    mechanicId = insertMechanic(testDb, { name: 'Carlos Lima', phone: '+5511777777777' });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('returns only the caller appointments in date-descending and startTime-descending order', async () => {
    const earlierDate = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-13',
      startTime: '16:00:00',
      endTime: '17:00:00',
    });
    const earlierTime = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-14',
      startTime: '09:00:00',
      endTime: '10:00:00',
    });
    const laterTime = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-14',
      startTime: '14:00:00',
      endTime: '15:00:00',
      vehicleInfo: 'Honda Civic',
      notes: 'Ruido nos freios',
    });
    const otherClient = makeUserToken(testDb, 'client');
    const hidden = insertAppointment(testDb, {
      clientId: otherClient.id,
      mechanicId,
      date: '2026-08-15',
      startTime: '18:00:00',
      endTime: '19:00:00',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/appointments?scope=admin',
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((appointment: { id: string }) => appointment.id)).toEqual([
      laterTime,
      earlierTime,
      earlierDate,
    ]);
    expect(response.body).not.toContain(hidden);
    expect(response.json()[0]).toEqual({
      id: laterTime,
      clientId,
      mechanicId,
      timeslotId: null,
      date: '2026-08-14',
      startTime: '14:00:00',
      endTime: '15:00:00',
      status: 'confirmado',
      vehicleInfo: 'Honda Civic',
      notes: 'Ruido nos freios',
      createdAt: expect.any(String),
      mechanicName: 'Carlos Lima',
      mechanicPhone: '+5511777777777',
      clientName: 'Test Person',
      clientPhone: null,
      serviceSummary: null,
      serviceDiagnosis: null,
      workPerformed: null,
      partsUsed: null,
      recommendations: null,
      totalAmountCents: null,
      closedAt: null,
      serviceItems: [],
    });
  });

  it('returns assigned appointments for a mechanic with all statuses and descending date/time order', async () => {
    testDb.connection.prepare('UPDATE profiles SET phone = ? WHERE id = ?').run('+5511555555555', clientId);
    const mechanicToken = signAccessToken({ userId: mechanicId, role: 'mechanic' }).token;
    const appointmentsByExpectedOrder = [
      insertAppointment(testDb, {
        clientId,
        mechanicId,
        date: '2026-08-16',
        startTime: '15:00:00',
        endTime: '16:00:00',
        status: 'acabado',
      }),
      insertAppointment(testDb, {
        clientId,
        mechanicId,
        date: '2026-08-16',
        startTime: '10:00:00',
        endTime: '11:00:00',
        status: 'cancelado',
      }),
      insertAppointment(testDb, {
        clientId,
        mechanicId,
        date: '2026-08-15',
        status: 'nao_finalizado',
      }),
      insertAppointment(testDb, {
        clientId,
        mechanicId,
        date: '2026-08-14',
        status: 'confirmado',
      }),
    ];
    const otherMechanic = insertMechanic(testDb);
    const hidden = insertAppointment(testDb, { clientId, mechanicId: otherMechanic, date: '2026-08-17' });

    const response = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((appointment: { id: string }) => appointment.id)).toEqual(
      appointmentsByExpectedOrder,
    );
    expect(response.body).not.toContain(hidden);
    expect(response.json().map((appointment: { status: string }) => appointment.status)).toEqual([
      'acabado',
      'cancelado',
      'nao_finalizado',
      'confirmado',
    ]);
    expect(response.json()[0]).toEqual(expect.objectContaining({
      mechanicName: 'Carlos Lima',
      mechanicPhone: null,
      clientName: 'Test Person',
      clientPhone: '+5511555555555',
    }));
  });

  it('returns NOT_IMPLEMENTED for a stored admin role', async () => {
    const caller = makeAdminToken(testDb);

    const response = await app.inject({
      method: 'GET',
      url: '/appointments',
      headers: auth(caller.token),
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toEqual({ error: 'not implemented', code: 'NOT_IMPLEMENTED' });
  });

  it('transitions a past confirmed appointment before returning the list', async () => {
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-11',
      status: 'confirmado',
    });

    const response = await app.inject({ method: 'GET', url: '/appointments', headers: auth(clientToken) });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].status).toBe('nao_finalizado');
    const stored = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get(appointmentId);
    expect(stored).toEqual({ status: 'nao_finalizado' });
  });
});

describe('GET /appointments/:id', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let clientId: string;
  let clientToken: string;
  let mechanicId: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    ({ id: clientId, token: clientToken } = makeUserToken(testDb, 'client'));
    mechanicId = insertMechanic(testDb, { name: 'Marina Costa', phone: '+5511666666666' });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('returns the owning client appointment with a byte-identical list shape', async () => {
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-14',
      startTime: '11:00:00',
      endTime: '12:00:00',
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(clientToken),
    });
    const list = await app.inject({ method: 'GET', url: '/appointments', headers: auth(clientToken) });

    expect(detail.statusCode).toBe(200);
    expect(detail.body).toBe(JSON.stringify(list.json()[0]));
    expect(detail.json()).toEqual(expect.objectContaining({
      id: appointmentId,
      clientId,
      mechanicId,
      mechanicName: 'Marina Costa',
      mechanicPhone: '+5511666666666',
      clientName: 'Test Person',
      clientPhone: null,
      serviceItems: [],
    }));
  });

  it('returns assigned detail to a mechanic with viewer-scoped contacts', async () => {
    testDb.connection.prepare('UPDATE profiles SET phone = ? WHERE id = ?').run('+5511444444444', clientId);
    const mechanicToken = signAccessToken({ userId: mechanicId, role: 'mechanic' }).token;
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId });

    const response = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      mechanicName: 'Marina Costa',
      mechanicPhone: null,
      clientName: 'Test Person',
      clientPhone: '+5511444444444',
    }));
  });

  it('makes wrong owner, mechanic, admin, and unknown id byte-identical 404 responses', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId });
    const otherClient = makeUserToken(testDb, 'client');
    const mechanic = makeMechanicToken(testDb);
    const admin = makeAdminToken(testDb);

    const wrongOwner = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(otherClient.token),
    });
    const wrongRole = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(mechanic.token),
    });
    const adminRole = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(admin.token),
    });
    const unknown = await app.inject({
      method: 'GET',
      url: `/appointments/${randomUUID()}`,
      headers: auth(clientToken),
    });

    expect(wrongOwner.statusCode).toBe(404);
    expect(wrongRole.statusCode).toBe(404);
    expect(adminRole.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(wrongOwner.body).toBe(unknown.body);
    expect(wrongRole.body).toBe(unknown.body);
    expect(adminRole.body).toBe(unknown.body);
    expect(unknown.json()).toEqual({ error: 'appointment not found', code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('returns service items in sort order from detail and list', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, status: 'acabado' });
    const firstId = randomUUID();
    const secondId = randomUUID();
    insertServiceReportItems(testDb, appointmentId, mechanicId, [
      { id: secondId, description: 'Mao de obra', amountCents: 20000, sortOrder: 1 },
      { id: firstId, description: 'Pastilhas', amountCents: 15000, sortOrder: 0 },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(clientToken),
    });
    const list = await app.inject({ method: 'GET', url: '/appointments', headers: auth(clientToken) });

    expect(response.statusCode).toBe(200);
    const expectedItems = [
      { id: firstId, description: 'Pastilhas', amountCents: 15000, sortOrder: 0 },
      { id: secondId, description: 'Mao de obra', amountCents: 20000, sortOrder: 1 },
    ];
    expect(response.json().serviceItems).toEqual(expectedItems);
    expect(list.json()[0].serviceItems).toEqual(expectedItems);
  });

  it('transitions a past confirmed appointment before returning detail', async () => {
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-11',
      status: 'confirmado',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/appointments/${appointmentId}`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('nao_finalizado');
    const stored = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get(appointmentId);
    expect(stored).toEqual({ status: 'nao_finalizado' });
  });
});

describe('POST /appointments', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let clientId: string;
  let clientToken: string;
  let mechanicId: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    ({ id: clientId, token: clientToken } = makeUserToken(testDb));
    mechanicId = insertMechanic(testDb, { name: 'João Silva', phone: '+5511999999999' });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('books a future slot, denormalizes it, trims input, and removes it from availability', async () => {
    const timeslotId = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '09:30:00',
      endTime: '10:30:00',
    });
    const transaction = vi.spyOn(testDb.db, 'transaction');

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId, vehicleInfo: '  Honda Civic  ', notes: '  Trocar pastilhas  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(transaction.mock.calls[0]?.[1]).toEqual({ behavior: 'immediate' });
    expect(response.json()).toEqual({
      id: expect.any(String),
      clientId,
      mechanicId,
      timeslotId,
      date: '2026-08-13',
      startTime: '09:30:00',
      endTime: '10:30:00',
      status: 'confirmado',
      vehicleInfo: 'Honda Civic',
      notes: 'Trocar pastilhas',
      createdAt: expect.any(String),
      mechanicName: 'João Silva',
      mechanicPhone: '+5511999999999',
      clientName: 'Test Person',
      clientPhone: null,
      serviceSummary: null,
      serviceDiagnosis: null,
      workPerformed: null,
      partsUsed: null,
      recommendations: null,
      totalAmountCents: null,
      closedAt: null,
      serviceItems: [],
    });

    const stored = testDb.connection
      .prepare(
        'SELECT mechanic_id, date, start_time, end_time, status, vehicle_info, notes FROM appointments WHERE id = ?',
      )
      .get(response.json().id);
    expect(stored).toEqual({
      mechanic_id: mechanicId,
      date: '2026-08-13',
      start_time: '09:30:00',
      end_time: '10:30:00',
      status: 'confirmado',
      vehicle_info: 'Honda Civic',
      notes: 'Trocar pastilhas',
    });

    const available = await app.inject({
      method: 'GET',
      url: `/mechanics/${mechanicId}/timeslots?date=2026-08-13`,
      headers: auth(clientToken),
    });
    expect(available.json()).toEqual([]);
  });

  it('stores omitted and whitespace-only optional input as null', async () => {
    const firstSlot = insertTimeslot(testDb, { mechanicId, date: '2026-08-13' });
    const secondSlot = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '10:00',
      endTime: '11:00',
    });

    const omitted = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId: firstSlot },
    });
    const empty = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId: secondSlot, vehicleInfo: '   ', notes: '' },
    });

    expect(omitted.json().vehicleInfo).toBeNull();
    expect(omitted.json().notes).toBeNull();
    expect(empty.json().vehicleInfo).toBeNull();
    expect(empty.json().notes).toBeNull();
  });

  it.each([
    { vehicleInfo: 'x'.repeat(121) },
    { notes: 'x'.repeat(1001) },
  ])('rejects over-length input before opening a transaction', async (fields) => {
    const timeslotId = insertTimeslot(testDb, { mechanicId, date: '2026-08-13' });
    const transaction = vi.spyOn(testDb.db, 'transaction');

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId, ...fields },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(['mechanic', 'admin'] as const)('rejects stored %s role before opening a transaction', async (role) => {
    const caller = makeUserToken(testDb, role);
    const timeslotId = insertTimeslot(testDb, { mechanicId, date: '2026-08-13' });
    const transaction = vi.spyOn(testDb.db, 'transaction');

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(caller.token),
      payload: { timeslotId },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns TIMESLOT_NOT_FOUND for an unknown slot', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId: randomUUID() },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'timeslot not found', code: 'TIMESLOT_NOT_FOUND' });
  });

  it('returns MECHANIC_UNAVAILABLE for a slot owned by an inactive mechanic', async () => {
    const inactive = insertMechanic(testDb, { isActive: 0 });
    const timeslotId = insertTimeslot(testDb, { mechanicId: inactive, date: '2026-08-13' });

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'mechanic unavailable', code: 'MECHANIC_UNAVAILABLE' });
  });

  it('returns TIMESLOT_UNAVAILABLE for an unavailable slot and rolls back notification fan-out', async () => {
    const timeslotId = insertTimeslot(testDb, { mechanicId, date: '2026-08-13', isAvailable: 0 });

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'timeslot unavailable', code: 'TIMESLOT_UNAVAILABLE' });
    expect(notificationRows(testDb)).toEqual([]);
  });

  it('returns TIMESLOT_EXPIRED when start is not future in Sao Paulo time', async () => {
    const timeslotId = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-12',
      startTime: '12:00:00',
      endTime: '13:00:00',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'timeslot expired', code: 'TIMESLOT_EXPIRED' });
  });

  it('maps the active-appointment unique-index violation after availability bookkeeping is forced stale', async () => {
    const otherClient = makeUserToken(testDb);
    const timeslotId = insertTimeslot(testDb, { mechanicId, date: '2026-08-13' });
    insertAppointment(testDb, {
      clientId: otherClient.id,
      mechanicId,
      timeslotId,
      date: '2026-08-13',
      status: 'confirmado',
    });
    testDb.connection.prepare('UPDATE timeslots SET is_available = 1 WHERE id = ?').run(timeslotId);

    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'timeslot unavailable', code: 'TIMESLOT_UNAVAILABLE' });
    expect(notificationRows(testDb)).toEqual([]);
  });

  it('writes exact confirmed notification and keeps mechanic name captured after rename', async () => {
    const timeslotId = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-09-03',
      startTime: '08:05:59',
      endTime: '09:05:59',
    });
    const mechanicToken = signAccessToken({ userId: mechanicId, role: 'mechanic' }).token;

    const booked = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });
    await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: auth(mechanicToken),
      payload: { name: 'Nome Novo' },
    });
    const listed = await app.inject({ method: 'GET', url: '/notifications', headers: auth(clientToken) });

    expect(notificationRows(testDb)).toEqual([
      {
        recipient_id: clientId,
        appointment_id: booked.json().id,
        type: 'appointment_confirmed',
        title: 'Agendamento confirmado',
        body: 'Seu agendamento com João Silva em 03/09 às 08:05 foi confirmado.',
      },
      {
        recipient_id: mechanicId,
        appointment_id: booked.json().id,
        type: 'appointment_confirmed',
        title: 'Novo agendamento',
        body: 'Test Person agendou com você em 03/09 às 08:05.',
      },
    ]);
    expect(listed.json()[0].body).toBe('Seu agendamento com João Silva em 03/09 às 08:05 foi confirmado.');
  });
});

describe('POST /appointments/:id/cancel', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let clientId: string;
  let clientToken: string;
  let mechanicId: string;
  let mechanicToken: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    ({ id: clientId, token: clientToken } = makeUserToken(testDb));
    mechanicId = insertMechanic(testDb, { name: 'Maria Souza', phone: '+5511888888888' });
    mechanicToken = signAccessToken({ userId: mechanicId, role: 'mechanic' }).token;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
    testDb.cleanup();
  });

  it('cancels a confirmed appointment, frees its slot, fans out, and permits rebooking', async () => {
    const timeslotId = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '14:20:30',
      endTime: '15:20:30',
      isAvailable: 0,
    });
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      timeslotId,
      date: '2026-08-13',
      startTime: '14:20:30',
      endTime: '15:20:30',
    });
    const transaction = vi.spyOn(testDb.db, 'transaction');

    const canceled = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });

    expect(canceled.statusCode).toBe(200);
    expect(transaction.mock.calls[0]?.[1]).toEqual({ behavior: 'immediate' });
    expect(canceled.json()).toEqual(expect.objectContaining({
      id: appointmentId,
      timeslotId,
      status: 'cancelado',
      mechanicName: 'Maria Souza',
      mechanicPhone: '+5511888888888',
      clientName: 'Test Person',
      clientPhone: null,
      serviceSummary: null,
      serviceDiagnosis: null,
      serviceItems: [],
    }));
    expect(notificationRows(testDb)).toEqual([
      {
        recipient_id: clientId,
        appointment_id: appointmentId,
        type: 'appointment_canceled',
        title: 'Agendamento cancelado',
        body: 'Seu agendamento com Maria Souza em 13/08 às 14:20 foi cancelado.',
      },
      {
        recipient_id: mechanicId,
        appointment_id: appointmentId,
        type: 'appointment_canceled',
        title: 'Agendamento cancelado',
        body: 'Test Person cancelou o agendamento de 13/08 às 14:20.',
      },
    ]);

    const rebooked = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });
    expect(rebooked.statusCode).toBe(201);
  });

  it('lets the assigned mechanic cancel a confirmed appointment and frees its slot', async () => {
    testDb.connection.prepare('UPDATE profiles SET phone = ? WHERE id = ?').run('+5511999999999', clientId);
    const timeslotId = insertTimeslot(testDb, {
      mechanicId,
      date: '2026-08-13',
      startTime: '14:20:30',
      endTime: '15:20:30',
      isAvailable: 0,
    });
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      timeslotId,
      date: '2026-08-13',
      startTime: '14:20:30',
      endTime: '15:20:30',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      id: appointmentId,
      timeslotId,
      status: 'cancelado',
      mechanicName: 'Maria Souza',
      mechanicPhone: null,
      clientName: 'Test Person',
      clientPhone: '+5511999999999',
    }));
    expect(testDb.connection.prepare('SELECT is_available FROM timeslots WHERE id = ?').get(timeslotId)).toEqual({
      is_available: 1,
    });
    expect(notificationRows(testDb)).toEqual([
      {
        recipient_id: clientId,
        appointment_id: appointmentId,
        type: 'appointment_canceled',
        title: 'Agendamento cancelado',
        body: 'Seu agendamento com Maria Souza em 13/08 às 14:20 foi cancelado.',
      },
    ]);
  });

  it('lets the assigned mechanic cancel an unfinalized appointment without a timeslot', async () => {
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      timeslotId: null,
      status: 'nao_finalizado',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      id: appointmentId,
      timeslotId: null,
      status: 'cancelado',
    }));
  });

  it('silently succeeds for an already canceled appointment without duplicate fan-out', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, status: 'cancelado' });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('cancelado');
    expect(notificationRows(testDb)).toEqual([]);
  });

  it('silently succeeds when the assigned mechanic cancels an already canceled appointment', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, status: 'cancelado' });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('cancelado');
    expect(notificationRows(testDb)).toEqual([]);
  });

  it.each(['nao_finalizado', 'acabado'] as const)('refuses cancellation from %s with exact message', async (status) => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, status });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: `cannot cancel appointment with status ${status}`,
      code: 'APPOINTMENT_NOT_CANCELLABLE',
    });
  });

  it('refuses mechanic cancellation from acabado with the exact existing message', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, status: 'acabado' });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(mechanicToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'cannot cancel appointment with status acabado',
      code: 'APPOINTMENT_NOT_CANCELLABLE',
    });
  });

  it('makes wrong owner, wrong mechanic, admin, and unknown id byte-identical 404 responses', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId });
    const other = makeUserToken(testDb);
    const otherMechanic = makeMechanicToken(testDb);
    const admin = makeAdminToken(testDb);

    const wrongOwner = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(other.token),
    });
    const adminResponse = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(admin.token),
    });
    const wrongMechanic = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(otherMechanic.token),
    });
    const unknown = await app.inject({
      method: 'POST',
      url: `/appointments/${randomUUID()}/cancel`,
      headers: auth(clientToken),
    });

    expect(wrongOwner.statusCode).toBe(404);
    expect(adminResponse.statusCode).toBe(404);
    expect(wrongMechanic.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(wrongOwner.body).toBe(unknown.body);
    expect(adminResponse.body).toBe(unknown.body);
    expect(wrongMechanic.body).toBe(unknown.body);
    expect(unknown.json()).toEqual({ error: 'appointment not found', code: 'APPOINTMENT_NOT_FOUND' });
  });

  it('cancels successfully when timeslotId is null', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId, timeslotId: null });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().timeslotId).toBeNull();
    expect(response.json().status).toBe('cancelado');
  });

  it('syncs past confirmed rows before the cancellation transaction and refuses by stored status', async () => {
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-11',
      status: 'confirmado',
    });
    const transaction = vi.spyOn(testDb.db, 'transaction');
    const update = vi.spyOn(testDb.db, 'update');

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'cannot cancel appointment with status nao_finalizado',
      code: 'APPOINTMENT_NOT_CANCELLABLE',
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(transaction.mock.invocationCallOrder[0]);
    expect(testDb.connection.inTransaction).toBe(false);
    const stored = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get(appointmentId);
    expect(stored).toEqual({ status: 'nao_finalizado' });
  });

  it('runs transition globally when another client acts', async () => {
    const firstClient = makeUserToken(testDb);
    const pastId = insertAppointment(testDb, {
      clientId: firstClient.id,
      mechanicId,
      date: '2026-08-11',
      status: 'confirmado',
    });
    const callerAppointment = insertAppointment(testDb, {
      clientId,
      mechanicId,
      date: '2026-08-13',
      status: 'cancelado',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/appointments/${callerAppointment}/cancel`,
      headers: auth(clientToken),
    });

    expect(response.statusCode).toBe(200);
    const transitioned = testDb.connection.prepare('SELECT status FROM appointments WHERE id = ?').get(pastId);
    expect(transitioned).toEqual({ status: 'nao_finalizado' });
  });

  it('uses the same flat serializer keys as booking', async () => {
    const timeslotId = insertTimeslot(testDb, { mechanicId, date: '2026-08-13', isAvailable: 0 });
    const appointmentId = insertAppointment(testDb, {
      clientId,
      mechanicId,
      timeslotId,
      date: '2026-08-13',
    });
    const canceled = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(clientToken),
    });
    const booked = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });

    expect(Object.keys(canceled.json()).sort()).toEqual(Object.keys(booked.json()).sort());
    expect(canceled.json()).toHaveProperty('timeslotId');
    expect(canceled.json()).toHaveProperty('serviceSummary', null);
    expect(canceled.json()).toHaveProperty('serviceDiagnosis', null);
    expect(canceled.json()).not.toHaveProperty('summary');
    expect(canceled.json()).not.toHaveProperty('diagnosis');
  });
});
