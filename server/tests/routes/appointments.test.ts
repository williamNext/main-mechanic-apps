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

type TestDb = ReturnType<typeof makeTestDb>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

function notificationRows(testDb: TestDb) {
  return testDb.connection
    .prepare('SELECT recipient_id, appointment_id, type, title, body FROM notifications ORDER BY created_at')
    .all();
}

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

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-12T15:00:00.000Z'));
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    ({ id: clientId, token: clientToken } = makeUserToken(testDb));
    mechanicId = insertMechanic(testDb, { name: 'Maria Souza', phone: '+5511888888888' });
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
    ]);

    const rebooked = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: auth(clientToken),
      payload: { timeslotId },
    });
    expect(rebooked.statusCode).toBe(201);
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

  it('makes wrong owner, wrong role, and unknown id byte-identical 404 responses', async () => {
    const appointmentId = insertAppointment(testDb, { clientId, mechanicId });
    const other = makeUserToken(testDb);
    const wrongRoleAppointmentId = insertAppointment(testDb, { clientId: mechanicId, mechanicId });
    const mechanicToken = signAccessToken({ userId: mechanicId, role: 'client' }).token;

    const wrongOwner = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: auth(other.token),
    });
    const wrongRole = await app.inject({
      method: 'POST',
      url: `/appointments/${wrongRoleAppointmentId}/cancel`,
      headers: auth(mechanicToken),
    });
    const unknown = await app.inject({
      method: 'POST',
      url: `/appointments/${randomUUID()}/cancel`,
      headers: auth(clientToken),
    });

    expect(wrongOwner.statusCode).toBe(404);
    expect(wrongRole.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(wrongOwner.body).toBe(unknown.body);
    expect(wrongRole.body).toBe(unknown.body);
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
