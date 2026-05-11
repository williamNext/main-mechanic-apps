import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return format(date, "dd 'de' MMM", { locale: ptBR });
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatTime(time: string): string {
  return time; // "HH:mm" already formatted
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export function getNextDays(count: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    days.push(format(addDays(new Date(), i), 'yyyy-MM-dd'));
  }
  return days;
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
