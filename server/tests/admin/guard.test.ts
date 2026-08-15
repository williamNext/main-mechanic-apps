import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { requireAdmin } from '../../src/admin/guard.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { profiles, type Role } from '../../src/db/schema.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';

describe('requireAdmin', () => {
  let testDb: ReturnType<typeof makeTestDb>;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    app.get('/admin/__test', { preHandler: requireAdmin(testDb.db) }, async () => ({ ok: true }));
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  function makeToken(storedRole: Role, tokenRole: Role = storedRole): string {
    const id = insertProfile(testDb, { role: storedRole });
    return signAccessToken({ userId: id, role: tokenRole }).token;
  }

  async function request(token?: string) {
    return app.inject({
      method: 'GET',
      url: '/admin/__test',
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
  }

  it('accepts an admin stored in the database', async () => {
    const response = await request(makeToken('admin'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized', code: 'UNAUTHENTICATED' });
  });

  it('rejects a client token', async () => {
    const response = await request(makeToken('client'));

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });

  it('rejects a mechanic token', async () => {
    const { token } = makeMechanicToken(testDb);
    const response = await request(token);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });

  it('rejects an admin token after its subject is demoted in the database', async () => {
    const id = insertProfile(testDb, { role: 'admin' });
    const { token } = signAccessToken({ userId: id, role: 'admin' });
    testDb.db.update(profiles).set({ role: 'client' }).where(eq(profiles.id, id)).run();

    const response = await request(token);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});
