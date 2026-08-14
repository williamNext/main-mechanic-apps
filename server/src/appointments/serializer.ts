import { sql } from 'drizzle-orm';
import {
  appointmentServiceReports,
  appointments,
  profiles,
} from '../db/schema.js';

const appointmentViewColumns = {
  id: appointments.id,
  clientId: appointments.clientId,
  mechanicId: appointments.mechanicId,
  timeslotId: appointments.timeslotId,
  date: appointments.date,
  startTime: appointments.startTime,
  endTime: appointments.endTime,
  status: appointments.status,
  vehicleInfo: appointments.vehicleInfo,
  notes: appointments.notes,
  createdAt: appointments.createdAt,
  serviceSummary: appointmentServiceReports.summary,
  serviceDiagnosis: appointmentServiceReports.diagnosis,
  workPerformed: appointmentServiceReports.workPerformed,
  partsUsed: appointmentServiceReports.partsUsed,
  recommendations: appointmentServiceReports.recommendations,
  totalAmountCents: appointmentServiceReports.totalAmountCents,
  closedAt: appointmentServiceReports.closedAt,
};

export function appointmentViewColumnsFor(viewer: 'client' | 'mechanic') {
  if (viewer === 'client') {
    return {
      ...appointmentViewColumns,
      mechanicName: profiles.name,
      mechanicPhone: profiles.phone,
      clientName: sql<string>`null`,
      clientPhone: sql<string | null>`null`,
    };
  }

  return {
    ...appointmentViewColumns,
    mechanicName: sql<string>`null`,
    mechanicPhone: sql<string | null>`null`,
    clientName: profiles.name,
    clientPhone: profiles.phone,
  };
}

export type ServiceItem = {
  id: string;
  description: string;
  amountCents: number;
  sortOrder: number;
};

export type AppointmentViewRow = {
  id: string;
  clientId: string;
  mechanicId: string;
  timeslotId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: 'confirmado' | 'nao_finalizado' | 'cancelado' | 'acabado';
  vehicleInfo: string | null;
  notes: string | null;
  createdAt: string;
  mechanicName: string;
  mechanicPhone: string | null;
  clientName: string;
  clientPhone: string | null;
  serviceSummary: string | null;
  serviceDiagnosis: string | null;
  workPerformed: string | null;
  partsUsed: string | null;
  recommendations: string | null;
  totalAmountCents: number | null;
  closedAt: string | null;
};

export function serializeAppointment(
  row: AppointmentViewRow,
  viewer: 'client' | 'mechanic',
  items: ServiceItem[],
) {
  return {
    ...row,
    mechanicPhone: viewer === 'client' ? row.mechanicPhone : null,
    clientPhone: viewer === 'mechanic' ? row.clientPhone : null,
    serviceItems: items,
  };
}
