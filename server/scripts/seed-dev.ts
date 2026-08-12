import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth/hash.js';
import { config } from '../src/config/index.js';
import { createDb, type Db } from '../src/db/client.js';
import { mechanics, profiles, timeslots } from '../src/db/schema.js';

export class SeedDevError extends Error {}

const SHARED_PASSWORD = 'SenhaDev123!';

const MECHANIC_SEEDS = [
  { id: 'seed-mechanic-1', name: 'Carlos Silva', specialty: 'Motor e Câmbio', email: 'carlos.silva@oficina.dev' },
  { id: 'seed-mechanic-2', name: 'Ana Souza', specialty: 'Freios e Suspensão', email: 'ana.souza@oficina.dev' },
  { id: 'seed-mechanic-3', name: 'João Pereira', specialty: 'Elétrica Automotiva', email: 'joao.pereira@oficina.dev' },
] as const;

const CLIENT_SEED = { id: 'seed-client-1', name: 'Mariana Costa', email: 'mariana.costa@oficina.dev' } as const;
const ADMIN_SEED = { id: 'seed-admin-1', name: 'Admin Dev', email: 'admin@oficina.dev' } as const;

const DAYS_AHEAD = 5;
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
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export interface SeedDevResult {
  mechanicIds: string[];
  clientId: string;
  adminId: string;
  timeslotCount: number;
  password: string;
}

export async function seedDev(db: Db): Promise<SeedDevResult> {
  const mechanicHashes = await Promise.all(MECHANIC_SEEDS.map(() => hashPassword(SHARED_PASSWORD)));
  const clientHash = await hashPassword(SHARED_PASSWORD);
  const adminHash = await hashPassword(SHARED_PASSWORD);

  const dates = Array.from({ length: DAYS_AHEAD }, (_, dayOffset) => dateOffset(dayOffset + 1));

  db.transaction((tx) => {
    MECHANIC_SEEDS.forEach((mechanic, i) => {
      tx.insert(profiles)
        .values({
          id: mechanic.id,
          name: mechanic.name,
          email: mechanic.email,
          role: 'mechanic',
          passwordHash: mechanicHashes[i],
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: { name: mechanic.name, email: mechanic.email, role: 'mechanic', passwordHash: mechanicHashes[i] },
        })
        .run();

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
          tx.insert(timeslots)
            .values({
              id: timeslotId,
              mechanicId: mechanic.id,
              date,
              startTime: slot.start,
              endTime: slot.end,
              isAvailable: true,
            })
            .onConflictDoUpdate({
              target: timeslots.id,
              set: {
                mechanicId: mechanic.id,
                date,
                startTime: slot.start,
                endTime: slot.end,
                isAvailable: true,
              },
            })
            .run();
        });
      });
    });

    tx.insert(profiles)
      .values({
        id: CLIENT_SEED.id,
        name: CLIENT_SEED.name,
        email: CLIENT_SEED.email,
        role: 'client',
        passwordHash: clientHash,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { name: CLIENT_SEED.name, email: CLIENT_SEED.email, role: 'client', passwordHash: clientHash },
      })
      .run();

    tx.insert(profiles)
      .values({
        id: ADMIN_SEED.id,
        name: ADMIN_SEED.name,
        email: ADMIN_SEED.email,
        role: 'admin',
        passwordHash: adminHash,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: { name: ADMIN_SEED.name, email: ADMIN_SEED.email, role: 'admin', passwordHash: adminHash },
      })
      .run();
  });

  const mechanicIds = MECHANIC_SEEDS.map((m) => m.id);
  console.log(`Seeded ${mechanicIds.length} mechanics, 1 client, 1 admin, ${mechanicIds.length * dates.length * SLOTS_PER_DAY.length} timeslots.`);

  return {
    mechanicIds,
    clientId: CLIENT_SEED.id,
    adminId: ADMIN_SEED.id,
    timeslotCount: mechanicIds.length * dates.length * SLOTS_PER_DAY.length,
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
      console.error(err instanceof SeedDevError ? err.message : 'Failed to seed dev data');
      process.exitCode = 1;
    })
    .finally(() => {
      connection.close();
    });
}
