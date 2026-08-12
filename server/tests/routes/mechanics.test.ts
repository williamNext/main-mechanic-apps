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
});
