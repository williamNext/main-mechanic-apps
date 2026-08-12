import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth/hash.js';
import { config } from '../src/config/index.js';
import { createDb, type Db } from '../src/db/client.js';
import { appointments, mechanics, profiles, timeslots, type Role } from '../src/db/schema.js';

const SHARED_PASSWORD = 'SenhaDev123!';

const MECHANIC_SEEDS = [
  { id: 'seed-mechanic-1', name: 'Carlos Silva', specialty: 'Motor e Câmbio', email: 'carlos.silva@oficina.dev' },
  { id: 'seed-mechanic-2', name: 'Ana Souza', specialty: 'Freios e Suspensão', email: 'ana.souza@oficina.dev' },
  { id: 'seed-mechanic-3', name: 'João Pereira', specialty: 'Elétrica Automotiva', email: 'joao.pereira@oficina.dev' },
] as const;

const INACTIVE_MECHANIC_SEED = {
  id: 'seed-mechanic-inactive-1',
  name: 'Paulo Inativo',
  specialty: 'Diagnostico',
  email: 'paulo.inativo@oficina.dev',
} as const;

const CLIENT_SEED = { id: 'seed-client-1', name: 'Mariana Costa', email: 'mariana.costa@oficina.dev' } as const;
const SECOND_CLIENT_SEED = { id: 'seed-client-2', name: 'Rafael Lima', email: 'rafael.lima@oficina.dev' } as const;
const ADMIN_SEED = { id: 'seed-admin-1', name: 'Admin Dev', email: 'admin@oficina.dev' } as const;

const DAYS_AHEAD = 7;
const SLOTS_PER_DAY = [
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '14:00', end: '15:00' },
] as const;

/**
 * True iff `dbPath`'s basename starts with `dev` immediately followed by
 * `.`, `-`, `_`, or end-of-string — so `dev.db`/`dev-workshop.db` pass but
 * `development.db` (more letters after "dev") does not. Guards the CLI
 * entrypoint against ever running this destructive-by-mistake script
 * against a database that isn't clearly a dev one.
 */
export function isDevelopmentDbPath(dbPath: string): boolean {
  return /^dev(?:[._-]|$)/i.test(path.basename(dbPath));
}

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

export interface SeedDevResult {
  mechanicIds: string[];
  clientId: string;
  secondClientId: string;
  clientIds: string[];
  adminId: string;
  timeslotCount: number;
  password: string;
}

function upsertProfile(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  seed: { id: string; name: string; email: string },
  role: Role,
  passwordHash: string,
) {
  const values = { id: seed.id, name: seed.name, email: seed.email, role, passwordHash };
  tx.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.id, set: values }).run();
}

function upsertTimeslot(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  values: {
    id: string;
    mechanicId: string;
    date: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  },
) {
  tx.insert(timeslots)
    .values(values)
    .onConflictDoUpdate({
      target: timeslots.id,
      set: values,
    })
    .run();
}

function upsertAppointment(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  values: {
    id: string;
    clientId: string;
    mechanicId: string;
    timeslotId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: 'confirmado' | 'nao_finalizado' | 'cancelado';
    vehicleInfo: string;
    notes: string | null;
  },
) {
  tx.insert(appointments)
    .values(values)
    .onConflictDoUpdate({
      target: appointments.id,
      set: values,
    })
    .run();
}

export async function seedDev(db: Db): Promise<SeedDevResult> {
  const sharedHash = await hashPassword(SHARED_PASSWORD);

  const dates = Array.from({ length: DAYS_AHEAD }, (_, dayOffset) => dateOffset(dayOffset + 1));
  const pastDate = dateOffset(-1);
  const activePastTimeslot = {
    id: 'seed-timeslot-past-active',
    mechanicId: MECHANIC_SEEDS[1].id,
    date: pastDate,
    startTime: '09:00',
    endTime: '10:00',
    isAvailable: true,
  };
  const inactiveTimeslots = [
    {
      id: 'seed-timeslot-inactive-0',
      mechanicId: INACTIVE_MECHANIC_SEED.id,
      date: dates[0],
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true,
    },
    {
      id: 'seed-timeslot-inactive-1',
      mechanicId: INACTIVE_MECHANIC_SEED.id,
      date: dates[1],
      startTime: '10:00',
      endTime: '11:00',
      isAvailable: true,
    },
  ];

  db.transaction((tx) => {
    MECHANIC_SEEDS.forEach((mechanic, i) => {
      upsertProfile(tx, mechanic, 'mechanic', sharedHash);

      tx.insert(mechanics)
        .values({ id: mechanic.id, specialty: mechanic.specialty, isActive: true })
        .onConflictDoUpdate({
          target: mechanics.id,
          set: { specialty: mechanic.specialty, isActive: true },
        })
        .run();

      dates.forEach((date, dayIndex) => {
        SLOTS_PER_DAY.forEach((slot, slotIndex) => {
          const timeslotId = `seed-timeslot-${i}-${dayIndex}-${slotIndex}`;
          upsertTimeslot(tx, {
            id: timeslotId,
            mechanicId: mechanic.id,
            date,
            startTime: slot.start,
            endTime: slot.end,
            isAvailable: true,
          });
        });
      });
    });

    upsertProfile(tx, INACTIVE_MECHANIC_SEED, 'mechanic', sharedHash);
    tx.insert(mechanics)
      .values({ id: INACTIVE_MECHANIC_SEED.id, specialty: INACTIVE_MECHANIC_SEED.specialty, isActive: false })
      .onConflictDoUpdate({
        target: mechanics.id,
        set: { specialty: INACTIVE_MECHANIC_SEED.specialty, isActive: false },
      })
      .run();

    upsertTimeslot(tx, activePastTimeslot);
    inactiveTimeslots.forEach((slot) => upsertTimeslot(tx, slot));

    upsertProfile(tx, CLIENT_SEED, 'client', sharedHash);
    upsertProfile(tx, SECOND_CLIENT_SEED, 'client', sharedHash);
    upsertProfile(tx, ADMIN_SEED, 'admin', sharedHash);

    upsertAppointment(tx, {
      id: 'seed-appointment-confirmado',
      clientId: CLIENT_SEED.id,
      mechanicId: MECHANIC_SEEDS[0].id,
      timeslotId: 'seed-timeslot-0-0-0',
      date: dates[0],
      startTime: '09:00',
      endTime: '10:00',
      status: 'confirmado',
      vehicleInfo: 'Honda Civic 2018',
      notes: null,
    });
    upsertAppointment(tx, {
      id: 'seed-appointment-nao-finalizado',
      clientId: CLIENT_SEED.id,
      mechanicId: MECHANIC_SEEDS[1].id,
      timeslotId: activePastTimeslot.id,
      date: pastDate,
      startTime: '09:00',
      endTime: '10:00',
      status: 'nao_finalizado',
      vehicleInfo: 'Fiat Argo 2020',
      notes: null,
    });
    upsertAppointment(tx, {
      id: 'seed-appointment-cancelado',
      clientId: CLIENT_SEED.id,
      mechanicId: MECHANIC_SEEDS[0].id,
      timeslotId: 'seed-timeslot-0-0-1',
      date: dates[0],
      startTime: '10:00',
      endTime: '11:00',
      status: 'cancelado',
      vehicleInfo: 'Toyota Corolla 2019',
      notes: null,
    });
  });

  const mechanicIds = MECHANIC_SEEDS.map((m) => m.id);
  const timeslotCount = mechanicIds.length * dates.length * SLOTS_PER_DAY.length + 1 + inactiveTimeslots.length;
  console.log(
    `Seeded ${mechanicIds.length} active mechanics, 1 inactive mechanic, 2 clients, 1 admin, ${timeslotCount} timeslots.`,
  );

  return {
    mechanicIds,
    clientId: CLIENT_SEED.id,
    secondClientId: SECOND_CLIENT_SEED.id,
    clientIds: [CLIENT_SEED.id, SECOND_CLIENT_SEED.id],
    adminId: ADMIN_SEED.id,
    timeslotCount,
    password: SHARED_PASSWORD,
  };
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  if (!isDevelopmentDbPath(config.DB_PATH)) {
    console.error(
      `Refusing to seed: DB_PATH (${config.DB_PATH}) does not look like a development database. ` +
        'Its filename must start with "dev" (e.g. dev.db, dev-workshop.sqlite).',
    );
    process.exit(1);
  }

  const { db, connection } = createDb(config.DB_PATH);
  seedDev(db)
    .catch((err) => {
      console.error(err instanceof Error ? err.message : 'Failed to seed dev data');
      process.exitCode = 1;
    })
    .finally(() => {
      connection.close();
    });
}
