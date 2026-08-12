import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { requireAuth, requireRole } from '../../src/auth/middleware.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile, makeMechanicToken } from '../helpers/profile.js';

describe('requireRole', () => {
  let testDb: ReturnType<typeof makeTestDb>;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);
    app.get(
      '/__test/mechanic-only',
      { preHandler: [requireAuth(testDb.db), requireRole(testDb.db, 'mechanic')] },
      async () => ({ ok: true }),
    );
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('accepts a caller by the stored profile role, not the token role claim', async () => {
    const { token } = makeMechanicToken(testDb, { email: 'stored-mechanic@example.com', tokenRole: 'client' });

    const res = await app.inject({
      method: 'GET',
      url: '/__test/mechanic-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects a stored client even when the token claims mechanic', async () => {
    const id = insertProfile(testDb, {
      name: 'Stored Client',
      email: 'stored-client@example.com',
      role: 'client',
    });
    const { token } = signAccessToken({ userId: id, role: 'mechanic' });

    const res = await app.inject({
      method: 'GET',
      url: '/__test/mechanic-only',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden', code: 'FORBIDDEN' });
  });
});
