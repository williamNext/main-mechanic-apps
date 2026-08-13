import { and, eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { appointments } from '../db/schema.js';
import { getSaoPauloDateTimeParts } from '../lib/sao-paulo-time.js';
import { mapAppointmentWriteError } from './transactions.js';

export function syncUnfinalized(db: Db): void {
  try {
    const today = getSaoPauloDateTimeParts().date;
    const predicate = and(eq(appointments.status, 'confirmado'), lt(appointments.date, today));
    const exists = db.select({ id: appointments.id }).from(appointments).where(predicate).limit(1).get();

    if (exists) {
      db.update(appointments).set({ status: 'nao_finalizado' }).where(predicate).run();
    }
  } catch (error) {
    mapAppointmentWriteError(error);
  }
}
