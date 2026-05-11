import { create } from 'zustand';
import { TimeSlot } from '@/types/models';
import * as timeslotService from '@/services/timeslot-service';

interface TimeSlotState {
  slots: TimeSlot[];
  isLoading: boolean;
  error: string | null;

  fetchByMechanic: (mechanicId: string) => Promise<void>;
  fetchAvailable: (mechanicId: string, date?: string) => Promise<void>;
  addSlot: (data: Omit<TimeSlot, 'id'>) => Promise<TimeSlot>;
  toggleAvailability: (slotId: string, isAvailable: boolean) => Promise<void>;
  removeSlot: (slotId: string) => Promise<void>;
}

export const useTimeSlotStore = create<TimeSlotState>((set) => ({
  slots: [],
  isLoading: false,
  error: null,

  fetchByMechanic: async (mechanicId) => {
    set({ isLoading: true, error: null });
    try {
      const slots = await timeslotService.getSlotsByMechanic(mechanicId);
      set({ slots, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar horários', isLoading: false });
    }
  },

  fetchAvailable: async (mechanicId, date) => {
    set({ isLoading: true, error: null });
    try {
      // Use getSlotsByMechanic and filter locally for availability to save tokens/complexity
      const allSlots = await timeslotService.getSlotsByMechanic(mechanicId, date);
      const available = allSlots.filter(s => s.isAvailable);
      set({ slots: available, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar horários disponíveis', isLoading: false });
    }
  },

  addSlot: async (data) => {
    const slot = await timeslotService.createSlot(data);
    set((state) => ({ slots: [...state.slots, slot] }));
    return slot;
  },

  toggleAvailability: async (slotId, isAvailable) => {
    await timeslotService.updateSlotAvailability(slotId, isAvailable);
    set((state) => ({
      slots: state.slots.map((s) => (s.id === slotId ? { ...s, isAvailable } : s)),
    }));
  },

  removeSlot: async (slotId) => {
    await timeslotService.deleteSlot(slotId);
    set((state) => ({
      slots: state.slots.filter((s) => s.id !== slotId),
    }));
  },
}));
