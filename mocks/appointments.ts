import { Appointment } from '@/types/models';
import { format, addDays } from 'date-fns';

const today = format(new Date(), 'yyyy-MM-dd');
const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

export const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    clientId: 'client-1',
    clientName: 'Maria Fernandes',
    mechanicId: 'mech-1',
    mechanicName: 'João Silva',
    timeSlotId: `slot-mech-1-${today}-09:00`,
    date: today,
    startTime: '09:00',
    endTime: '10:00',
    status: 'confirmado',
    vehicleInfo: 'Honda Civic 2020 — Barulho no motor',
    createdAt: '2026-05-07T10:00:00Z',
  },
  {
    id: 'apt-2',
    clientId: 'client-2',
    clientName: 'Lucas Almeida',
    mechanicId: 'mech-2',
    mechanicName: 'Pedro Santos',
    timeSlotId: `slot-mech-2-${today}-14:00`,
    date: today,
    startTime: '14:00',
    endTime: '15:00',
    status: 'confirmado',
    vehicleInfo: 'Toyota Corolla 2022 — Problema elétrico',
    createdAt: '2026-05-07T14:00:00Z',
  },
  {
    id: 'apt-3',
    clientId: 'client-1',
    clientName: 'Maria Fernandes',
    mechanicId: 'mech-3',
    mechanicName: 'Ana Oliveira',
    timeSlotId: `slot-mech-3-${tomorrow}-10:00`,
    date: tomorrow,
    startTime: '10:00',
    endTime: '11:00',
    status: 'confirmado',
    vehicleInfo: 'Ford Ka 2019 — Revisão suspensão',
    createdAt: '2026-05-07T16:00:00Z',
  },
];
