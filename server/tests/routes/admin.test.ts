import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
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
