import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { appointments, mechanics, profiles, timeslots } from '../../src/db/schema.js';
import { isDevelopmentDbPath, seedDev } from '../../scripts/seed-dev.js';
import { makeTestDb } from '../helpers/db.js';

const SHARED_PASSWORD = 'SenhaDev123!';

function dateOffset(daysFromToday: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const d = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + daysFromToday));
  return d.toISOString().slice(0, 10);
}

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

  it('populates mechanics, timeslots, clients and an admin in one call', async () => {
    const result = await seedDev(testDb.db);

    expect(result.mechanicIds).toHaveLength(3);
    expect(result.clientIds).toEqual(['seed-client-1', 'seed-client-2']);
    expect(result.secondClientId).toBe('seed-client-2');
    expect(result.timeslotCount).toBe(66);

    const mechanicRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'mechanic')).all();
    expect(mechanicRows).toHaveLength(4);

    const clientRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'client')).all();
    expect(clientRows).toHaveLength(2);

    const adminRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'admin')).all();
    expect(adminRows).toHaveLength(1);

    const timeslotRows = testDb.db.select().from(timeslots).all();
    expect(timeslotRows).toHaveLength(66);

    const mechanicTableRows = testDb.db.select().from(mechanics).all();
    expect(mechanicTableRows).toHaveLength(4);
    expect(mechanicTableRows.filter((m) => m.isActive)).toHaveLength(3);
    expect(mechanicTableRows.filter((m) => !m.isActive)).toHaveLength(1);
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
      .where(eq(mechanics.isActive, true))
      .all()
      .map((m) => m.specialty)
      .sort();
    expect(specialties).toEqual(['Elétrica Automotiva', 'Freios e Suspensão', 'Motor e Câmbio'].sort());
  });

  it('spreads active mechanic timeslots across the next seven Sao Paulo dates', async () => {
    const expectedDates = Array.from({ length: 7 }, (_, i) => dateOffset(i + 1));
    await seedDev(testDb.db);

    const rows = testDb.connection
      .prepare(
        `SELECT t.date
         FROM timeslots t
         JOIN mechanics m ON m.id = t.mechanic_id
         WHERE m.is_active = 1 AND t.date >= ?
         ORDER BY t.date`,
      )
      .all(expectedDates[0]) as { date: string }[];
    const distinctDates = new Set(rows.map((r) => r.date));
    expect([...distinctDates]).toEqual(expectedDates);
  });

  it('seeds a past-dated slot and inactive mechanic slots', async () => {
    const today = dateOffset(0);
    await seedDev(testDb.db);

    const pastRows = testDb.db.select().from(timeslots).all().filter((slot) => slot.date < today);
    expect(pastRows.length).toBeGreaterThanOrEqual(1);

    const inactiveRows = testDb.connection
      .prepare(
        `SELECT t.id
         FROM timeslots t
         JOIN mechanics m ON m.id = t.mechanic_id
         WHERE m.is_active = 0`,
      )
      .all() as { id: string }[];
    expect(inactiveRows.map((r) => r.id).sort()).toEqual(['seed-timeslot-inactive-0', 'seed-timeslot-inactive-1']);
  });

  it('seeds one confirmado, one nao_finalizado and one cancelado appointment for the known client', async () => {
    await seedDev(testDb.db);

    const rows = testDb.db.select().from(appointments).where(eq(appointments.clientId, 'seed-client-1')).all();
    expect(rows.map((row) => row.status).sort()).toEqual(['cancelado', 'confirmado', 'nao_finalizado']);
  });

  it('documents the second client login and shared password in README', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');

    expect(readme).toContain('rafael.lima@oficina.dev');
    expect(readme).toContain(SHARED_PASSWORD);
  });

  it('each seeded role can log in through POST /auth/login with the documented password', async () => {
    await seedDev(testDb.db);

    for (const email of [
      'mariana.costa@oficina.dev',
      'rafael.lima@oficina.dev',
      'carlos.silva@oficina.dev',
      'admin@oficina.dev',
    ]) {
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
      appointments: testDb.db.select().from(appointments).all().length,
    };

    await seedDev(testDb.db);

    const countsAfter = {
      profiles: testDb.db.select().from(profiles).all().length,
      mechanics: testDb.db.select().from(mechanics).all().length,
      timeslots: testDb.db.select().from(timeslots).all().length,
      appointments: testDb.db.select().from(appointments).all().length,
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
