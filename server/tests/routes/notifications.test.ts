import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

function insertNotification(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    recipientId: string;
    appointmentId: string | null;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO notifications
         (id, recipient_id, appointment_id, type, title, body, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.recipientId,
      overrides.appointmentId ?? null,
      overrides.type ?? 'booking_confirmed',
      overrides.title ?? 'Booking confirmed',
      overrides.body ?? 'Your booking is set',
      overrides.readAt ?? null,
      overrides.createdAt ?? '2026-08-12T12:00:00.000Z',
    );
  return id;
}

function readAt(testDb: TestDb, id: string): string | null {
  const row = testDb.connection.prepare('SELECT read_at FROM notifications WHERE id = ?').get(id) as {
    read_at: string | null;
  };
  return row.read_at;
}

describe('notification read endpoints', () => {
  let testDb: TestDb;
  let app: FastifyInstance;
  let recipientId: string;
  let otherRecipientId: string;
  let token: string;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    recipientId = insertProfile(testDb, { role: 'client' });
    otherRecipientId = insertProfile(testDb, { role: 'client' });
    token = signAccessToken({ userId: recipientId, role: 'client' }).token;
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('returns caller notifications newest first with camelCase fields', async () => {
    const older = insertNotification(testDb, {
      recipientId,
      createdAt: '2026-08-12T10:00:00.000Z',
      readAt: '2026-08-12T11:00:00.000Z',
    });
    const newer = insertNotification(testDb, {
      recipientId,
      type: 'appointment_reminder',
      title: 'Reminder',
      body: 'Appointment soon',
      createdAt: '2026-08-12T12:00:00.000Z',
    });
    insertNotification(testDb, { recipientId: otherRecipientId, createdAt: '2026-08-12T13:00:00.000Z' });

    const response = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: newer,
        recipientId,
        appointmentId: null,
        type: 'appointment_reminder',
        title: 'Reminder',
        body: 'Appointment soon',
        readAt: null,
        createdAt: '2026-08-12T12:00:00.000Z',
      },
      {
        id: older,
        recipientId,
        appointmentId: null,
        type: 'booking_confirmed',
        title: 'Booking confirmed',
        body: 'Your booking is set',
        readAt: '2026-08-12T11:00:00.000Z',
        createdAt: '2026-08-12T10:00:00.000Z',
      },
    ]);
  });

  it('returns only the caller 50 most recent notifications', async () => {
    const ids = Array.from({ length: 51 }, (_, index) =>
      insertNotification(testDb, {
        recipientId,
        createdAt: `2026-08-12T${String(index).padStart(2, '0')}:00:00.000Z`,
      }),
    );
    const otherId = insertNotification(testDb, { recipientId: otherRecipientId, createdAt: '9999-12-31T23:59:59.999Z' });

    const response = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });

    const returnedIds = response.json().map((notification: { id: string }) => notification.id);
    expect(response.statusCode).toBe(200);
    expect(returnedIds).toHaveLength(50);
    expect(returnedIds).toEqual(ids.slice(1).reverse());
    expect(returnedIds).not.toContain(otherId);
  });

  it('leaves unread count and timestamps unchanged when listing notifications', async () => {
    const first = insertNotification(testDb, { recipientId });
    const second = insertNotification(testDb, { recipientId, createdAt: '2026-08-12T13:00:00.000Z' });
    const before = [readAt(testDb, first), readAt(testDb, second)];

    const countBefore = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });
    const list = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    const countAfter = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(countBefore.json()).toEqual({ count: 2 });
    expect(list.statusCode).toBe(200);
    expect(countAfter.json()).toEqual({ count: 2 });
    expect([readAt(testDb, first), readAt(testDb, second)]).toEqual(before);
  });

  it('returns unread count as an integer for the caller only', async () => {
    insertNotification(testDb, { recipientId });
    insertNotification(testDb, { recipientId, createdAt: '2026-08-12T13:00:00.000Z' });
    insertNotification(testDb, { recipientId, readAt: '2026-08-12T14:00:00.000Z' });
    insertNotification(testDb, { recipientId: otherRecipientId });

    const response = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ count: 2 });
    expect(Number.isInteger(response.json().count)).toBe(true);
  });

  it('marks caller notification read and returns 204', async () => {
    const id = insertNotification(testDb, { recipientId });

    const response = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(readAt(testDb, id)).not.toBeNull();
  });

  it('keeps readAt byte-identical when marking an already-read notification', async () => {
    const originalReadAt = '2026-08-12T14:15:16.123Z';
    const id = insertNotification(testDb, { recipientId, readAt: originalReadAt });
    const before = readAt(testDb, id);

    const response = await app.inject({
      method: 'POST',
      url: `/notifications/${id}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(204);
    expect(readAt(testDb, id)).toBe(before);
    expect(readAt(testDb, id)).toBe(originalReadAt);
  });

  it('returns byte-identical 404 responses for unknown and other-recipient ids', async () => {
    const otherId = insertNotification(testDb, { recipientId: otherRecipientId });

    const other = await app.inject({
      method: 'POST',
      url: `/notifications/${otherId}/read`,
      headers: { authorization: `Bearer ${token}` },
    });
    const unknown = await app.inject({
      method: 'POST',
      url: `/notifications/${randomUUID()}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(other.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(other.body).toBe(unknown.body);
    expect(other.json()).toEqual({ error: 'notification not found', code: 'NOTIFICATION_NOT_FOUND' });
    expect(readAt(testDb, otherId)).toBeNull();
  });

  it('marks only caller unread notifications read and returns 204', async () => {
    const callerUnread = insertNotification(testDb, { recipientId });
    const callerReadAt = '2026-08-12T14:15:16.123Z';
    const callerRead = insertNotification(testDb, { recipientId, readAt: callerReadAt });
    const otherUnread = insertNotification(testDb, { recipientId: otherRecipientId });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(readAt(testDb, callerUnread)).not.toBeNull();
    expect(readAt(testDb, callerRead)).toBe(callerReadAt);
    expect(readAt(testDb, otherUnread)).toBeNull();
  });

  it.each<{ method: 'GET' | 'POST'; url: string }>([
    { method: 'GET', url: '/notifications' },
    { method: 'GET', url: '/notifications/unread-count' },
    { method: 'POST', url: `/notifications/${randomUUID()}/read` },
    { method: 'POST', url: '/notifications/read-all' },
  ])('requires authentication for $method $url', async ({ method, url }) => {
    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
  });
});
