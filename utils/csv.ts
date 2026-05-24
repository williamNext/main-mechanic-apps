import { Platform } from 'react-native';
import { AdminAppointmentRow, AdminFinancialReport, AdminMechanicRow } from '@/types/models';

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n');
}

function appointmentStatusLabel(status: string): string {
  if (status === 'cancelado') return 'Cancelado';
  if (status === 'nao_finalizado') return 'Nao finalizado';
  if (status === 'acabado') return 'Finalizado';
  return 'Confirmado';
}

function money(cents?: number | null): string {
  return ((cents ?? 0) / 100).toFixed(2);
}

export function mechanicsToCsv(rows: AdminMechanicRow[]): string {
  return rowsToCsv(
    ['ID', 'Nome', 'Email', 'Telefone', 'Especialidade', 'Credenciais', 'Ativo', 'Agendamentos', 'Ultimo agendamento'],
    rows.map((row) => [
      row.id,
      row.name,
      row.email,
      row.phone,
      row.specialty,
      row.credentials,
      row.isActive ? 'sim' : 'nao',
      row.appointmentsTotal,
      row.lastAppointmentDate,
    ]),
  );
}

export function appointmentsToCsv(rows: AdminAppointmentRow[]): string {
  return rowsToCsv(
    ['ID', 'Data', 'Inicio', 'Fim', 'Status', 'Cliente', 'Telefone do cliente', 'Mecanico', 'Telefone do mecanico', 'Veiculo', 'Observacoes', 'Resumo do servico', 'Detalhamento', 'Valor total'],
    rows.map((row) => [
      row.id,
      row.date,
      row.startTime,
      row.endTime,
      appointmentStatusLabel(row.status),
      row.clientName,
      row.clientPhone,
      row.mechanicName,
      row.mechanicPhone,
      row.vehicleInfo,
      row.notes,
      row.serviceSummary,
      row.workPerformed,
      money(row.totalAmountCents),
    ]),
  );
}

export function financeToCsv(report: AdminFinancialReport): string {
  return rowsToCsv(
    ['ID', 'Data', 'Cliente', 'Mecanico', 'Veiculo', 'Servico', 'Valor total', 'Fechado em'],
    report.appointments.map((row) => [
      row.id,
      row.date,
      row.clientName,
      row.mechanicName,
      row.vehicleInfo,
      row.serviceSummary,
      money(row.totalAmountCents),
      row.closedAt,
    ]),
  );
}

export function downloadCsv(filename: string, csv: string) {
  if (Platform.OS !== 'web') {
    throw new Error('Download de CSV disponivel na web');
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
