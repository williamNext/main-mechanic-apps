import type { AppointmentStatus } from '@main-mechanic/types';
import { describe, expect, test } from 'vitest';

import { StatusLabels, statusTheme } from '../src/theme';

const appointmentStatuses = [
  'confirmado',
  'nao_finalizado',
  'cancelado',
  'acabado',
] as const satisfies readonly AppointmentStatus[];

type MissingAppointmentStatuses = Exclude<
  AppointmentStatus,
  (typeof appointmentStatuses)[number]
>;

const allAppointmentStatusesAreListed: MissingAppointmentStatuses extends never
  ? true
  : false = true;

describe('appointment status theme coverage', () => {
  test.each(appointmentStatuses)('%s has a label and theme', (status) => {
    expect(allAppointmentStatusesAreListed).toBe(true);
    expect(StatusLabels).toHaveProperty(status);
    expect(statusTheme).toHaveProperty(status);
  });
});
