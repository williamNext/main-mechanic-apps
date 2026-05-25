import { addDays, format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  return formatDateDisplay(dateStr);
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function parseISODateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  return isValid(date) ? date : null;
}

export function formatDateDisplay(dateStr?: string | null): string {
  const date = parseISODateSafe(dateStr);
  return date ? format(date, 'dd/MM/yyyy') : '';
}

export function formatDateMonthDisplay(dateStr?: string | null): string {
  const date = parseISODateSafe(dateStr);
  return date ? format(date, 'MM/yyyy') : '';
}

export function formatDateDayMonthDisplay(dateStr?: string | null): string {
  const date = parseISODateSafe(dateStr);
  return date ? format(date, 'dd/MM') : '';
}

export function formatTime(time: string): string {
  return time;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export function getNextDays(count: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < count; i += 1) {
    days.push(format(addDays(new Date(), i), 'yyyy-MM-dd'));
  }
  return days;
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
