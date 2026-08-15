import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import {
  appointmentServiceItems,
  appointmentServiceReports,
  appointments,
  mechanics,
  profiles,
  timeslots,
} from '../../src/db/schema.js';
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

function previousMonth(date: string): string {
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
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
    expect(result.timeslotCount).toBe(68);

    const mechanicRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'mechanic')).all();
    expect(mechanicRows).toHaveLength(4);

    const clientRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'client')).all();
    expect(clientRows).toHaveLength(2);

    const adminRows = testDb.db.select().from(profiles).where(eq(profiles.role, 'admin')).all();
    expect(adminRows).toHaveLength(1);

    expect([...mechanicRows, ...clientRows, ...adminRows].every((profile) => profile.phone !== null)).toBe(true);
    expect(clientRows.find((profile) => profile.id === 'seed-client-1')?.phone).toBe('+5511988880001');

    const timeslotRows = testDb.db.select().from(timeslots).all();
    expect(timeslotRows).toHaveLength(68);

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

  it('seeds every lifecycle status plus the additional previous-month completed appointment', async () => {
    await seedDev(testDb.db);

    const rows = testDb.db.select().from(appointments).all();
    expect(rows.map((row) => row.status).sort()).toEqual([
      'acabado',
      'acabado',
      'cancelado',
      'confirmado',
      'nao_finalizado',
    ]);
  });

  it('seeds a priced completed appointment in the previous Sao Paulo calendar month', async () => {
    await seedDev(testDb.db);

    const appointment = testDb.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, 'seed-appointment-acabado-previous-month'))
      .get();
    const expectedMonth = previousMonth(dateOffset(0));
    expect(appointment).toMatchObject({
      timeslotId: 'seed-timeslot-completed-previous-month',
      status: 'acabado',
    });
    expect(appointment?.date.slice(0, 7)).toBe(expectedMonth);

    const slot = testDb.db
      .select()
      .from(timeslots)
      .where(eq(timeslots.id, 'seed-timeslot-completed-previous-month'))
      .get();
    expect(slot).toMatchObject({ isAvailable: false, date: appointment?.date });

    const report = testDb.db
      .select()
      .from(appointmentServiceReports)
      .where(eq(appointmentServiceReports.appointmentId, appointment!.id))
      .get();
    expect(report).toMatchObject({
      mechanicId: 'seed-mechanic-1',
      summary: 'Revisão preventiva concluída',
      diagnosis: expect.any(String),
      workPerformed: expect.any(String),
      partsUsed: expect.any(String),
      recommendations: expect.any(String),
      totalAmountCents: 45000,
    });

    const items = testDb.db
      .select()
      .from(appointmentServiceItems)
      .where(eq(appointmentServiceItems.appointmentId, appointment!.id))
      .all();
    expect(items).toEqual([
      expect.objectContaining({ description: 'Troca de óleo e filtros', amountCents: 45000, sortOrder: 0 }),
    ]);
    expect(items.reduce((total, item) => total + item.amountCents, 0)).toBe(report?.totalAmountCents);
  });

  it('seeds a completed appointment with an unavailable dedicated timeslot and full ordered report', async () => {
    await seedDev(testDb.db);

    const appointment = testDb.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, 'seed-appointment-acabado'))
      .get();
    expect(appointment).toMatchObject({
      clientId: 'seed-client-2',
      mechanicId: 'seed-mechanic-3',
      timeslotId: 'seed-timeslot-completed',
      status: 'acabado',
      vehicleInfo: 'Volkswagen T-Cross 2021',
    });

    const completedSlot = testDb.db
      .select()
      .from(timeslots)
      .where(eq(timeslots.id, 'seed-timeslot-completed'))
      .get();
    expect(completedSlot).toMatchObject({
      mechanicId: 'seed-mechanic-3',
      isAvailable: false,
      startTime: '14:00',
      endTime: '15:00',
    });

    const report = testDb.db
      .select()
      .from(appointmentServiceReports)
      .where(eq(appointmentServiceReports.appointmentId, 'seed-appointment-acabado'))
      .get();
    expect(report).toMatchObject({
      mechanicId: 'seed-mechanic-3',
      summary: 'Revisão do sistema de freios dianteiros concluída',
      diagnosis: 'Pastilhas dianteiras desgastadas e discos com leve irregularidade superficial.',
      workPerformed: 'Substituição das pastilhas dianteiras, limpeza do conjunto e ajuste do sistema de freios.',
      partsUsed: 'Um jogo de pastilhas de freio dianteiras.',
      recommendations: 'Revisar discos e fluido de freio após 10.000 km ou seis meses.',
      totalAmountCents: 70000,
    });

    const items = testDb.db
      .select()
      .from(appointmentServiceItems)
      .where(eq(appointmentServiceItems.appointmentId, 'seed-appointment-acabado'))
      .all()
      .sort((left, right) => left.sortOrder - right.sortOrder);
    expect(items.map(({ id, description, amountCents, sortOrder }) => ({ id, description, amountCents, sortOrder })))
      .toEqual([
        {
          id: 'seed-service-item-0',
          description: 'Diagnóstico do sistema de freios',
          amountCents: 15000,
          sortOrder: 0,
        },
        {
          id: 'seed-service-item-1',
          description: 'Jogo de pastilhas de freio dianteiras',
          amountCents: 32000,
          sortOrder: 1,
        },
        {
          id: 'seed-service-item-2',
          description: 'Mão de obra para substituição e ajuste',
          amountCents: 23000,
          sortOrder: 2,
        },
      ]);
    expect(items.reduce((total, item) => total + item.amountCents, 0)).toBe(report?.totalAmountCents);
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
      appointmentServiceReports: testDb.db.select().from(appointmentServiceReports).all().length,
      appointmentServiceItems: testDb.db.select().from(appointmentServiceItems).all().length,
    };

    await seedDev(testDb.db);

    const countsAfter = {
      profiles: testDb.db.select().from(profiles).all().length,
      mechanics: testDb.db.select().from(mechanics).all().length,
      timeslots: testDb.db.select().from(timeslots).all().length,
      appointments: testDb.db.select().from(appointments).all().length,
      appointmentServiceReports: testDb.db.select().from(appointmentServiceReports).all().length,
      appointmentServiceItems: testDb.db.select().from(appointmentServiceItems).all().length,
    };

    expect(countsAfter).toEqual(countsBefore);
    expect(countsAfter.appointmentServiceReports).toBe(2);
    expect(countsAfter.appointmentServiceItems).toBe(4);

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
