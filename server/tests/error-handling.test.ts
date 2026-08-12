import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { HttpError } from '../src/errors.js';
import { makeTestDb } from './helpers/db.js';

describe('error handler (house envelope, D-C)', () => {
  let testDb: ReturnType<typeof makeTestDb>;
  let app: FastifyInstance;

  beforeEach(() => {
    testDb = makeTestDb();
    app = buildApp(testDb.db, testDb.connection);

    app.get('/__test/throws-http-error', async () => {
      throw new HttpError(409, 'conflicting resource');
    });

    app.get('/__test/throws-unexpected', async () => {
      throw new Error('super secret internal detail');
    });

    app.post('/__test/echo', async (request) => {
      return { body: request.body };
    });
  });

  afterEach(async () => {
    await app.close();
    testDb.cleanup();
  });

  it('an HttpError responds with its own status and message', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/throws-http-error' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'conflicting resource' });
  });

  it('an unexpected exception responds 500 with a generic message, never the original', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/throws-unexpected' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal error' });
    expect(res.body).not.toMatch(/super secret internal detail/);
  });

  it('a malformed JSON body still returns Fastify native 400, not 500', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/__test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not valid json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(res.json().error.toLowerCase());
  });

  it('a request to an unknown route still returns 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/this/route/does/not/exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe(res.json().error.toLowerCase());
  });

  it('every envelope message is lowercase', async () => {
    const httpErrorRes = await app.inject({ method: 'GET', url: '/__test/throws-http-error' });
    expect(httpErrorRes.json().error).toBe(httpErrorRes.json().error.toLowerCase());

    const unexpectedRes = await app.inject({ method: 'GET', url: '/__test/throws-unexpected' });
    expect(unexpectedRes.json().error).toBe('internal error');
  });
});
