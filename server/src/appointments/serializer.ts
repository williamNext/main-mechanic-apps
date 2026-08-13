import {
  appointmentServiceReports,
  appointments,
  profiles,
} from '../db/schema.js';

export const appointmentViewColumns = {
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
  mechanicName: profiles.name,
  mechanicPhone: profiles.phone,
  serviceSummary: appointmentServiceReports.summary,
  serviceDiagnosis: appointmentServiceReports.diagnosis,
  workPerformed: appointmentServiceReports.workPerformed,
  partsUsed: appointmentServiceReports.partsUsed,
  recommendations: appointmentServiceReports.recommendations,
  totalAmountCents: appointmentServiceReports.totalAmountCents,
  closedAt: appointmentServiceReports.closedAt,
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
  serviceSummary: string | null;
  serviceDiagnosis: string | null;
  workPerformed: string | null;
  partsUsed: string | null;
  recommendations: string | null;
  totalAmountCents: number | null;
  closedAt: string | null;
};

export function serializeAppointment(row: AppointmentViewRow) {
  return { ...row, serviceItems: [] };
}
