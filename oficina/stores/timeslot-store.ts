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

  fetchAvailable: (mechanicId: string, date?: string, options?: { force?: boolean }) => Promise<void>;
  invalidateCache: () => void;
}

export const useTimeSlotStore = create<TimeSlotState>((set, get) => ({
  slots: [],
  isLoading: false,
  error: null,
  fetchedAt: null,
  fetchKey: null,

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

  invalidateCache: () => {
    set({ fetchedAt: null, fetchKey: null });
  },
}));
