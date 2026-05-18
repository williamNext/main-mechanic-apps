import { TimeSlot } from '@/types/models';
import { format, addDays } from 'date-fns';

function generateSlots(mechanicId: string, daysAhead: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const hours = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  for (let d = 0; d < daysAhead; d++) {
    const date = format(addDays(new Date(), d), 'yyyy-MM-dd');
    for (const hour of hours) {
      const endHour = `${String(parseInt(hour.split(':')[0]) + 1).padStart(2, '0')}:00`;
      slots.push({
        id: `slot-${mechanicId}-${date}-${hour}`,
        mechanicId,
        date,
        startTime: hour,
        endTime: endHour,
        isAvailable: Math.random() > 0.3, // 70% available
      });
    }
  }
  return slots;
}

export const mockTimeSlots: TimeSlot[] = [
  ...generateSlots('mech-1', 7),
  ...generateSlots('mech-2', 7),
  ...generateSlots('mech-3', 7),
  ...generateSlots('mech-4', 7),
];
