import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, ALLOWED_ORIGINS } from '../src/app.js';
import { makeTestDb } from './helpers/db.js';

describe('CORS (D-G)', () => {
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

  it.each(ALLOWED_ORIGINS)('a preflight from %s receives the expected CORS headers', async (origin) => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'Authorization',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('a preflight from an origin not on the list receives no CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://evil.example.com',
        'access-control-request-method': 'GET',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('credentials are not enabled for an allowed origin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: ALLOWED_ORIGINS[0] },
    });

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('an authenticated cross-origin call succeeds with Authorization as an allowed header', async () => {
    const signupRes = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'cors@example.com', password: 'correct-horse-battery' },
    });
    const { token } = signupRes.json();

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        origin: ALLOWED_ORIGINS[0],
        authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGINS[0]);
  });
});
