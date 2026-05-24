import { addDays, format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return format(date, 'dd MMM', { locale: ptBR });
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR });
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
