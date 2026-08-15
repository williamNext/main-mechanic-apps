import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth/hash.js';
import { config } from '../src/config/index.js';
import { createDb, type Db } from '../src/db/client.js';
import { getSaoPauloDateTimeParts } from '../src/lib/sao-paulo-time.js';
import {
  appointmentServiceItems,
  appointmentServiceReports,
  appointments,
  mechanics,
  profiles,
  timeslots,
  type Role,
} from '../src/db/schema.js';

const SHARED_PASSWORD = 'SenhaDev123!';

const MECHANIC_SEEDS = [
  {
    id: 'seed-mechanic-1',
    name: 'Carlos Silva',
    specialty: 'Motor e Câmbio',
    email: 'carlos.silva@oficina.dev',
    phone: '+5511999990001',
  },
  {
    id: 'seed-mechanic-2',
    name: 'Ana Souza',
    specialty: 'Freios e Suspensão',
    email: 'ana.souza@oficina.dev',
    phone: '+5511999990002',
  },
  {
    id: 'seed-mechanic-3',
    name: 'João Pereira',
    specialty: 'Elétrica Automotiva',
    email: 'joao.pereira@oficina.dev',
    phone: '+5511999990003',
  },
] as const;

const INACTIVE_MECHANIC_SEED = {
  id: 'seed-mechanic-inactive-1',
  name: 'Paulo Inativo',
  specialty: 'Diagnostico',
  email: 'paulo.inativo@oficina.dev',
  phone: '+5511999990004',
} as const;

const CLIENT_SEED = {
  id: 'seed-client-1',
  name: 'Mariana Costa',
  email: 'mariana.costa@oficina.dev',
  phone: '+5511988880001',
} as const;
const SECOND_CLIENT_SEED = {
  id: 'seed-client-2',
  name: 'Rafael Lima',
  email: 'rafael.lima@oficina.dev',
  phone: '+5511988880002',
} as const;
const ADMIN_SEED = {
  id: 'seed-admin-1',
  name: 'Admin Dev',
  email: 'admin@oficina.dev',
  phone: '+5511977770001',
} as const;

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

function previousMonthDate(): string {
  const [yearText, monthText] = getSaoPauloDateTimeParts().date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return `${previousYear}-${String(previousMonth).padStart(2, '0')}-15`;
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
  seed: { id: string; name: string; email: string; phone: string },
  role: Role,
  passwordHash: string,
) {
  const values = { id: seed.id, name: seed.name, email: seed.email, phone: seed.phone, role, passwordHash };
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
    status: 'confirmado' | 'nao_finalizado' | 'cancelado' | 'acabado';
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
  const completedTimeslot = {
    id: 'seed-timeslot-completed',
    mechanicId: MECHANIC_SEEDS[2].id,
    date: pastDate,
    startTime: '14:00',
    endTime: '15:00',
    isAvailable: false,
  };
  const previousMonthCompletedTimeslot = {
    id: 'seed-timeslot-completed-previous-month',
    mechanicId: MECHANIC_SEEDS[0].id,
    date: previousMonthDate(),
    startTime: '16:00',
    endTime: '17:00',
    isAvailable: false,
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
    upsertTimeslot(tx, completedTimeslot);
    upsertTimeslot(tx, previousMonthCompletedTimeslot);
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
    upsertAppointment(tx, {
      id: 'seed-appointment-acabado',
      clientId: SECOND_CLIENT_SEED.id,
      mechanicId: MECHANIC_SEEDS[2].id,
      timeslotId: completedTimeslot.id,
      date: completedTimeslot.date,
      startTime: completedTimeslot.startTime,
      endTime: completedTimeslot.endTime,
      status: 'acabado',
      vehicleInfo: 'Volkswagen T-Cross 2021',
      notes: 'Cliente relatou ruído ao frear e vibração no volante.',
    });

    upsertAppointment(tx, {
      id: 'seed-appointment-acabado-previous-month',
      clientId: CLIENT_SEED.id,
      mechanicId: MECHANIC_SEEDS[0].id,
      timeslotId: previousMonthCompletedTimeslot.id,
      date: previousMonthCompletedTimeslot.date,
      startTime: previousMonthCompletedTimeslot.startTime,
      endTime: previousMonthCompletedTimeslot.endTime,
      status: 'acabado',
      vehicleInfo: 'Chevrolet Onix 2020',
      notes: 'Revisão preventiva concluída no mês anterior.',
    });

    const serviceItems = [
      { id: 'seed-service-item-0', description: 'Diagnóstico do sistema de freios', amountCents: 15000, sortOrder: 0 },
      { id: 'seed-service-item-1', description: 'Jogo de pastilhas de freio dianteiras', amountCents: 32000, sortOrder: 1 },
      {
        id: 'seed-service-item-2',
        description: 'Mão de obra para substituição e ajuste',
        amountCents: 23000,
        sortOrder: 2,
      },
    ];
    const totalAmountCents = serviceItems.reduce((total, item) => total + item.amountCents, 0);
    const reportValues = {
      appointmentId: 'seed-appointment-acabado',
      mechanicId: MECHANIC_SEEDS[2].id,
      summary: 'Revisão do sistema de freios dianteiros concluída',
      diagnosis: 'Pastilhas dianteiras desgastadas e discos com leve irregularidade superficial.',
      workPerformed: 'Substituição das pastilhas dianteiras, limpeza do conjunto e ajuste do sistema de freios.',
      partsUsed: 'Um jogo de pastilhas de freio dianteiras.',
      recommendations: 'Revisar discos e fluido de freio após 10.000 km ou seis meses.',
      totalAmountCents,
    };
    tx.insert(appointmentServiceReports)
      .values(reportValues)
      .onConflictDoUpdate({ target: appointmentServiceReports.appointmentId, set: reportValues })
      .run();

    serviceItems.forEach((item) => {
      const values = { ...item, appointmentId: 'seed-appointment-acabado' };
      tx.insert(appointmentServiceItems)
        .values(values)
        .onConflictDoUpdate({ target: appointmentServiceItems.id, set: values })
        .run();
    });

    const previousMonthReportValues = {
      appointmentId: 'seed-appointment-acabado-previous-month',
      mechanicId: MECHANIC_SEEDS[0].id,
      summary: 'Revisão preventiva concluída',
      diagnosis: 'Filtros saturados e óleo próximo do limite recomendado.',
      workPerformed: 'Troca de óleo e filtros, inspeção dos freios e calibração dos pneus.',
      partsUsed: 'Óleo do motor e filtros de óleo e ar.',
      recommendations: 'Retornar para nova revisão em 10.000 km.',
      totalAmountCents: 45000,
    };
    tx.insert(appointmentServiceReports)
      .values(previousMonthReportValues)
      .onConflictDoUpdate({ target: appointmentServiceReports.appointmentId, set: previousMonthReportValues })
      .run();

    const previousMonthItemValues = {
      id: 'seed-service-item-previous-month-0',
      appointmentId: 'seed-appointment-acabado-previous-month',
      description: 'Troca de óleo e filtros',
      amountCents: 45000,
      sortOrder: 0,
    };
    tx.insert(appointmentServiceItems)
      .values(previousMonthItemValues)
      .onConflictDoUpdate({ target: appointmentServiceItems.id, set: previousMonthItemValues })
      .run();
  });

  const mechanicIds = MECHANIC_SEEDS.map((m) => m.id);
  const timeslotCount = mechanicIds.length * dates.length * SLOTS_PER_DAY.length + 3 + inactiveTimeslots.length;
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
