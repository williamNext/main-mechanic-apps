import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { mechanics, profiles, timeslots } from '../../src/db/schema.js';
import { isDevelopmentDbPath, seedDev } from '../../scripts/seed-dev.js';
import { makeTestDb } from '../helpers/db.js';

const SHARED_PASSWORD = 'SenhaDev123!';

describe('seedDev', () => {
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

  it('populates mechanics, timeslots, a client and an admin in one call', async () => {
    const result = await seedDev(testDb.db);

    expect(result.mechanicIds).toHaveLength(3);
    expect(result.timeslotCount).toBe(45);

    const mechanicRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'mechanic')).all();
    expect(mechanicRows).toHaveLength(3);

    const clientRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'client')).all();
    expect(clientRows).toHaveLength(1);

    const adminRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'admin')).all();
    expect(adminRows).toHaveLength(1);

    const timeslotRows = testDb.db.select().from(timeslots).all();
    expect(timeslotRows).toHaveLength(45);

    const mechanicTableRows = testDb.db.select().from(mechanics).all();
    expect(mechanicTableRows).toHaveLength(3);
    expect(mechanicTableRows.every((m) => m.isActive)).toBe(true);
  });

  it('seeds mechanics with the specified Brazilian names and Portuguese specialties', async () => {
    await seedDev(testDb.db);

    const rows = testDb.db.select().from(profiles).where(eq(profiles.role, 'mechanic')).all();
    const byEmail = new Map(rows.map((r) => [r.email, r.name]));

    expect(byEmail.get('carlos.silva@oficina.dev')).toBe('Carlos Silva');
    expect(byEmail.get('ana.souza@oficina.dev')).toBe('Ana Souza');
    expect(byEmail.get('joao.pereira@oficina.dev')).toBe('João Pereira');

    const specialties = testDb.db
      .select()
      .from(mechanics)
      .all()
      .map((m) => m.specialty)
      .sort();
    expect(specialties).toEqual(['Elétrica Automotiva', 'Freios e Suspensão', 'Motor e Câmbio'].sort());
  });

  it('spreads timeslots across multiple distinct dates', async () => {
    await seedDev(testDb.db);

    const rows = testDb.db.select().from(timeslots).all();
    const distinctDates = new Set(rows.map((r) => r.date));
    expect(distinctDates.size).toBeGreaterThanOrEqual(5);
  });

  it('each seeded role can log in through POST /auth/login with the documented password', async () => {
    await seedDev(testDb.db);

    for (const email of ['mariana.costa@oficina.dev', 'carlos.silva@oficina.dev', 'admin@oficina.dev']) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: SHARED_PASSWORD },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('running seedDev twice leaves row counts unchanged and the password still works', async () => {
    await seedDev(testDb.db);

    const countsBefore = {
      profiles: testDb.db.select().from(profiles).all().length,
      mechanics: testDb.db.select().from(mechanics).all().length,
      timeslots: testDb.db.select().from(timeslots).all().length,
    };

    await seedDev(testDb.db);

    const countsAfter = {
      profiles: testDb.db.select().from(profiles).all().length,
      mechanics: testDb.db.select().from(mechanics).all().length,
      timeslots: testDb.db.select().from(timeslots).all().length,
    };

    expect(countsAfter).toEqual(countsBefore);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@oficina.dev', password: SHARED_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('isDevelopmentDbPath', () => {
  it('accepts dev-prefixed basenames, case-insensitively', () => {
    expect(isDevelopmentDbPath('dev.db')).toBe(true);
    expect(isDevelopmentDbPath('dev.sqlite')).toBe(true);
    expect(isDevelopmentDbPath('dev-workshop.db')).toBe(true);
    expect(isDevelopmentDbPath('DEV.DB')).toBe(true);
    expect(isDevelopmentDbPath('./data/dev.db')).toBe(true);
  });

  it('rejects non-dev basenames', () => {
    expect(isDevelopmentDbPath('prod.db')).toBe(false);
    expect(isDevelopmentDbPath('workshop.db')).toBe(false);
    expect(isDevelopmentDbPath('development.db')).toBe(false);
  });

  it('rejects a path where only a parent directory (not the basename) contains "dev"', () => {
    expect(isDevelopmentDbPath('data/prod/dev-looking-dir/workshop.db')).toBe(false);
  });
});
