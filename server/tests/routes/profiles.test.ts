import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { mechanics, profiles, publicMechanics } from '../../src/db/schema.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';

describe('PATCH /profiles/me', () => {
  let testDb: ReturnType<typeof makeTestDb>;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('updates the caller profile and returns the seven-field user', async () => {
    const id = insertProfile(testDb, {
      name: 'Old Name',
      email: 'client@example.com',
      role: 'client',
      phone: '+5511999999999',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
    const otherId = insertProfile(testDb, { name: 'Other User' });
    const { token } = signAccessToken({ userId: id, role: 'client' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id,
      name: 'New Name',
      email: 'client@example.com',
      role: 'client',
      phone: '+5511999999999',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      specialty: null,
    });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('New Name');
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, otherId)).get()?.name).toBe('Other User');
  });

  it('trims the name before storing and returning it', async () => {
    const id = insertProfile(testDb);
    const { token } = signAccessToken({ userId: id, role: 'client' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '  Trimmed Name  ' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Trimmed Name');
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Trimmed Name');
  });

  it('accepts a name of exactly 120 characters', async () => {
    const id = insertProfile(testDb);
    const { token } = signAccessToken({ userId: id, role: 'client' });
    const name = 'x'.repeat(120);

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe(name);
  });

  it.each([{ payload: {} }, { payload: { name: '' } }, { payload: { name: '   ' } }, { payload: { name: 'x'.repeat(121) } }])(
    'rejects an absent, empty, or overlong name: $payload',
    async ({ payload }) => {
      const id = insertProfile(testDb, { name: 'Original Name' });
      const { token } = signAccessToken({ userId: id, role: 'client' });

      const res = await app.inject({
        method: 'PATCH',
        url: '/profiles/me',
        headers: { authorization: `Bearer ${token}` },
        payload,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
      expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Original Name');
    },
  );

  it('rejects role escalation and leaves the stored role unchanged', async () => {
    const id = insertProfile(testDb, { name: 'Client Name', role: 'client' });
    const { token } = signAccessToken({ userId: id, role: 'client' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Admin Name', role: 'admin' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    const stored = testDb.db.select().from(profiles).where(eq(profiles.id, id)).get();
    expect(stored?.role).toBe('client');
    expect(stored?.name).toBe('Client Name');
  });

  it.each([
    { role: 'client', tokenRole: 'mechanic' },
    { role: 'admin', tokenRole: 'admin' },
  ] as const)('rejects specialty for a stored $role caller', async ({ role, tokenRole }) => {
    const id = insertProfile(testDb, { name: 'Original Name', role });
    const { token } = signAccessToken({ userId: id, role: tokenRole });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Changed Name', specialty: 'Suspensao' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Original Name');
  });

  it.each([
    { name: 'Changed Name', email: 'changed@example.com' },
    { name: 'Changed Name', unexpected: true },
  ])('rejects unknown body keys: $email$unexpected', async (payload) => {
    const id = insertProfile(testDb, { name: 'Original Name' });
    const { token } = signAccessToken({ userId: id, role: 'client' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Original Name');
  });

  it('rejects an unauthenticated request before changing the profile', async () => {
    const id = insertProfile(testDb, { name: 'Original Name' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      payload: { name: 'Changed Name' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Original Name');
  });

  it('propagates a mechanic rename to public_mechanics', async () => {
    const { id, token } = makeMechanicToken(testDb, { name: 'Old Mechanic Name' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Mechanic Name' },
    });

    expect(res.statusCode).toBe(200);
    const projection = testDb.db
      .select({ name: publicMechanics.name })
      .from(publicMechanics)
      .where(eq(publicMechanics.id, id))
      .get();
    expect(projection?.name).toBe('New Mechanic Name');
  });

  it('updates mechanic name and specialty and propagates specialty to public_mechanics', async () => {
    const { id, token } = makeMechanicToken(testDb, {
      name: 'Old Mechanic Name',
      specialty: 'Freios',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Mechanic Name', specialty: 'Suspensao' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      name: 'New Mechanic Name',
      role: 'mechanic',
      specialty: 'Suspensao',
    });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('New Mechanic Name');
    expect(testDb.db.select().from(mechanics).where(eq(mechanics.id, id)).get()?.specialty).toBe('Suspensao');
    const projection = testDb.db
      .select({ specialty: publicMechanics.specialty })
      .from(publicMechanics)
      .where(eq(publicMechanics.id, id))
      .get();
    expect(projection?.specialty).toBe('Suspensao');
  });

  it.each([
    { credentials: 'Nova credencial' },
    { isActive: false },
    { is_active: false },
  ])('rejects mechanic-owned forbidden fields: $credentials$isActive', async (extra) => {
    const { id, token } = makeMechanicToken(testDb, { credentials: 'ASE' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/profiles/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Changed Name', specialty: 'Suspensao', ...extra },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid request body', code: 'VALIDATION_FAILED' });
    expect(testDb.db.select().from(profiles).where(eq(profiles.id, id)).get()?.name).toBe('Mechanic Person');
    expect(testDb.db.select().from(mechanics).where(eq(mechanics.id, id)).get()).toMatchObject({
      specialty: 'Freios',
      credentials: 'ASE',
      isActive: true,
    });
  });
});
