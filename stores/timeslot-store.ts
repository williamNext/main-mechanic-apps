import { create } from 'zustand';
import { TimeSlot } from '@/types/models';
import * as timeslotService from '@/services/timeslot-service';

const TIMESLOTS_CACHE_TTL_MS = 60 * 1000;

interface TimeSlotState {
  slots: TimeSlot[];
  isLoading: boolean;
  error: string | null;
  fetchedAt: number | null;
  fetchKey: string | null;

  fetchByMechanic: (mechanicId: string, options?: { force?: boolean }) => Promise<void>;
  fetchAvailable: (mechanicId: string, date?: string, options?: { force?: boolean }) => Promise<void>;
  addSlot: (data: Omit<TimeSlot, 'id'>) => Promise<TimeSlot>;
  toggleAvailability: (slotId: string, isAvailable: boolean) => Promise<void>;
  removeSlot: (slotId: string) => Promise<void>;
  invalidateCache: () => void;
}

export const useTimeSlotStore = create<TimeSlotState>((set, get) => ({
  slots: [],
  isLoading: false,
  error: null,
  fetchedAt: null,
  fetchKey: null,

  fetchByMechanic: async (mechanicId, options) => {
    const fetchKey = `all:${mechanicId}`;
    const { fetchedAt, fetchKey: currentFetchKey } = get();
    const cacheFresh = fetchedAt !== null && Date.now() - fetchedAt < TIMESLOTS_CACHE_TTL_MS;

    if (!options?.force && currentFetchKey === fetchKey && cacheFresh) return;

    set({ isLoading: true, error: null });
    try {
      const slots = await timeslotService.getSlotsByMechanic(mechanicId);
      set({ slots, fetchKey, fetchedAt: Date.now(), isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar horários', isLoading: false });
    }
  },

  fetchAvailable: async (mechanicId, date, options) => {
    const fetchKey = `available:${mechanicId}:${date ?? 'all'}`;
    const { fetchedAt, fetchKey: currentFetchKey } = get();
    const cacheFresh = fetchedAt !== null && Date.now() - fetchedAt < TIMESLOTS_CACHE_TTL_MS;

    if (!options?.force && currentFetchKey === fetchKey && cacheFresh) return;

    set({ isLoading: true, error: null });
    try {
      const available = await timeslotService.getAvailableSlotsByMechanic(mechanicId, date);
      set({ slots: available, fetchKey, fetchedAt: Date.now(), isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar horários disponíveis', isLoading: false });
    }
  },

  addSlot: async (data) => {
    const slot = await timeslotService.createSlot(data);
    set((state) => ({ slots: [...state.slots, slot], fetchedAt: null, fetchKey: null }));
    return slot;
  },

  toggleAvailability: async (slotId, isAvailable) => {
    await timeslotService.updateSlotAvailability(slotId, isAvailable);
    set((state) => ({
      slots: state.slots.map((s) => (s.id === slotId ? { ...s, isAvailable } : s)),
      fetchedAt: null,
      fetchKey: null,
    }));
  },

  removeSlot: async (slotId) => {
    await timeslotService.deleteSlot(slotId);
    set((state) => ({
      slots: state.slots.filter((s) => s.id !== slotId),
      fetchedAt: null,
      fetchKey: null,
    }));
  },

  invalidateCache: () => {
    set({ fetchedAt: null, fetchKey: null });
  },
}));
