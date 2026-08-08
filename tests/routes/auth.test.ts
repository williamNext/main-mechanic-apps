import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { profiles } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db.js';

const JWT_SECRET = 'test-secret-at-least-32-characters-long';

describe('POST /auth/signup', () => {
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

  it('responds 201 with a token and a client-role user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user.role).toBe('client');
  });

  it('decoded JWT carries sub, role, and a non-empty jti', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'ana2@example.com', password: 'correct-horse-battery' },
    });

    const body = res.json();
    const decoded = jwt.verify(body.token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      sub: string;
      role: string;
      jti: string;
    };
    expect(decoded.sub).toBe(body.user.id);
    expect(decoded.role).toBe('client');
    expect(decoded.jti).toBeTruthy();
  });

  it('stores an argon2id hash, never the plaintext password', async () => {
    const email = 'ana3@example.com';
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email, password: 'correct-horse-battery' },
    });

    const row = testDb.db.select().from(profiles).where(eq(profiles.email, email)).get();
    expect(row).toBeDefined();
    expect(row!.role).toBe('client');
    expect(row!.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row!.passwordHash).not.toBe('correct-horse-battery');
  });

  it('never returns password or password_hash in the response body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'ana4@example.com', password: 'correct-horse-battery' },
    });

    const raw = res.body;
    expect(raw).not.toMatch(/password/i);
  });

  it('responds 409 on duplicate email and creates no second row', async () => {
    const email = 'dupe@example.com';
    const payload = { name: 'Ana', email, password: 'correct-horse-battery' };

    const first = await app.inject({ method: 'POST', url: '/auth/signup', payload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: 'POST', url: '/auth/signup', payload });
    expect(second.statusCode).toBe(409);

    const count = testDb.connection
      .prepare('SELECT COUNT(*) as c FROM profiles WHERE email = ?')
      .get(email) as { c: number };
    expect(count.c).toBe(1);
  });

  it('ignores a client-supplied role and always creates a client account (D-07)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        name: 'Wannabe Admin',
        email: 'admin-attempt@example.com',
        password: 'correct-horse-battery',
        role: 'admin',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('client');
  });

  it('responds 400 for a malformed email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'not-an-email', password: 'correct-horse-battery' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('responds 400 for a password shorter than 8 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email: 'shortpw@example.com', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /health', () => {
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

  it('responds 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
