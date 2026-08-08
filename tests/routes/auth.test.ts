import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createDb } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { profiles } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../helpers/db.js';
import { seedAdmin } from '../../scripts/seed-admin.js';

const JWT_SECRET = 'test-secret-at-least-32-characters-long';

/**
 * Creates a throwaway SQLite file path (not yet migrated) suitable for
 * simulating a genuine process restart: open connection 1, close it, open
 * connection 2 against the SAME file, per Task 1's restart-survival case.
 * Deliberately does not reuse tests/helpers/db.ts's makeTestDb(), which
 * hides its path and is scoped to a single connection lifetime.
 */
function makeRestartableDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'workshop-server-test-'));
  return path.join(dir, `${randomUUID()}.sqlite`);
}

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

describe('POST /auth/login', () => {
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

  async function signup(email: string, password = 'correct-horse-battery') {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email, password },
    });
    return res.json();
  }

  it('logs in with the signup email and password, returning the same user id and role client', async () => {
    const signupBody = await signup('login-happy@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login-happy@example.com', password: 'correct-horse-battery' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user.id).toBe(signupBody.user.id);
    expect(body.user.role).toBe('client');
  });

  it('mints a token whose jti differs from the signup token, each login is a distinct session', async () => {
    const email = 'login-jti@example.com';
    const signupBody = await signup(email);
    const signupDecoded = jwt.decode(signupBody.token) as { jti: string };

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'correct-horse-battery' },
    });
    const loginDecoded = jwt.decode(res.json().token) as { sub: string; role: string; jti: string };

    expect(loginDecoded.sub).toBe(signupBody.user.id);
    expect(loginDecoded.role).toBe('client');
    expect(loginDecoded.jti).toBeTruthy();
    expect(loginDecoded.jti).not.toBe(signupDecoded.jti);
  });

  it('succeeds when the submitted email differs from the stored one only by whitespace and case', async () => {
    const storedEmail = 'casewhitespace@example.com';
    await signup(storedEmail);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: '  CaseWhitespace@Example.com  ', password: 'correct-horse-battery' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('an admin created by the seed helper can log in and receives role admin (any-role half of AUTH-02)', async () => {
    await seedAdmin(testDb.db, {
      name: 'Root Admin',
      email: 'admin-login@example.com',
      password: 'admin-password-123',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin-login@example.com', password: 'admin-password-123' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe('admin');
  });

  it('returns an identical response for an unknown email and a known email with the wrong password', async () => {
    const email = 'wrong-password@example.com';
    await signup(email);

    const unknownRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'never-signed-up@example.com', password: 'whatever-password' },
    });
    const wrongPasswordRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'totally-wrong-password' },
    });

    expect(unknownRes.statusCode).toBe(wrongPasswordRes.statusCode);
    expect(unknownRes.body).toBe(wrongPasswordRes.body);
  });

  it('responds 400 for a malformed email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email', password: 'whatever-password' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('responds 400 for an absent password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'someone@example.com' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('never returns password or password_hash in the response body', async () => {
    const email = 'no-secret-leak@example.com';
    await signup(email);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'correct-horse-battery' },
    });

    expect(res.body).not.toMatch(/password/i);
  });
});

describe('GET /auth/me', () => {
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

  async function signupAndGetBody(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Ana', email, password: 'correct-horse-battery' },
    });
    return res.json();
  }

  it('returns the caller profile for a valid token', async () => {
    const signupBody = await signupAndGetBody('me@example.com');

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${signupBody.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: signupBody.user.id,
      name: 'Ana',
      email: 'me@example.com',
      role: 'client',
    });
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with a header lacking the Bearer scheme', async () => {
    const signupBody = await signupAndGetBody('me-noscheme@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: signupBody.token },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a syntactically invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a well-formed token signed with a different secret', async () => {
    const forged = jwt.sign({ sub: 'someone', role: 'client', jti: 'x' }, 'a-completely-different-secret-32-chars', {
      algorithm: 'HS256',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${forged}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a token whose payload segment was edited after signing', async () => {
    const signupBody = await signupAndGetBody('me-tampered@example.com');
    const [header, payload, signature] = signupBody.token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decodedPayload.role = 'admin';
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tamperedToken}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token whose header declares algorithm none', async () => {
    const noneToken = jwt.sign({ sub: 'someone', role: 'client', jti: 'x' }, null, { algorithm: 'none' });
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${noneToken}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Session survives restart (core AUTH-02 claim)', () => {
  it('accepts, from a second app instance over the same file, a token issued by the first', async () => {
    const dbPath = makeRestartableDbPath();

    const first = createDb(dbPath);
    runMigrations(first.db);
    const app1 = buildApp(first.db, first.connection);

    const signupRes = await app1.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { name: 'Restart User', email: 'restart@example.com', password: 'correct-horse-battery' },
    });
    const token = signupRes.json().token;

    await app1.close();
    first.connection.close();

    const second = createDb(dbPath);
    const app2 = buildApp(second.db, second.connection);

    const meRes = await app2.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe('restart@example.com');

    await app2.close();
    second.connection.close();
  });
});

describe('scripts/seed-admin', () => {
  let testDb: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it('creates exactly one admin profile with an argon2id hash differing from the supplied password', async () => {
    const result = await seedAdmin(testDb.db, {
      name: 'Root Admin',
      email: 'seed-admin@example.com',
      password: 'admin-password-123',
    });

    const row = testDb.db.select().from(profiles).where(eq(profiles.id, result.id)).get();
    expect(row).toBeDefined();
    expect(row!.role).toBe('admin');
    expect(row!.email).toBe('seed-admin@example.com');
    expect(row!.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(row!.passwordHash).not.toBe('admin-password-123');
  });

  it('the created admin can immediately log in through POST /auth/login', async () => {
    await seedAdmin(testDb.db, {
      name: 'Root Admin',
      email: 'seed-login@example.com',
      password: 'admin-password-123',
    });

    const app = buildApp(testDb.db, testDb.connection);
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'seed-login@example.com', password: 'admin-password-123' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('refuses to create a second admin', async () => {
    await seedAdmin(testDb.db, { name: 'First', email: 'first-admin@example.com', password: 'admin-password-123' });

    await expect(
      seedAdmin(testDb.db, { name: 'Second', email: 'second-admin@example.com', password: 'admin-password-456' }),
    ).rejects.toThrow();

    const count = testDb.connection.prepare("SELECT COUNT(*) as c FROM profiles WHERE role = 'admin'").get() as {
      c: number;
    };
    expect(count.c).toBe(1);
  });

  it('rejects a password shorter than the signup minimum', async () => {
    await expect(
      seedAdmin(testDb.db, { name: 'Root Admin', email: 'short-pw@example.com', password: 'short' }),
    ).rejects.toThrow();
  });

  it('never writes the supplied password to stdout or stderr', async () => {
    const password = 'super-secret-password-value';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await seedAdmin(testDb.db, { name: 'Root Admin', email: 'no-leak@example.com', password });
    await seedAdmin(testDb.db, { name: 'Second', email: 'no-leak-2@example.com', password }).catch(() => {});

    const allOutput = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
    expect(allOutput).not.toContain(password);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
