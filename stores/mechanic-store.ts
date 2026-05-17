import { create } from 'zustand';
import { Mechanic } from '@/types/models';
import * as mechanicService from '@/services/mechanic-service';

const MECHANICS_CACHE_TTL_MS = 5 * 60 * 1000;

interface MechanicState {
  mechanics: Mechanic[];
  isLoading: boolean;
  error: string | null;
  fetchedAt: number | null;

  fetchAll: (options?: { force?: boolean }) => Promise<void>;
  getById: (id: string) => Promise<Mechanic | null>;
}

export const useMechanicStore = create<MechanicState>((set, get) => ({
  mechanics: [],
  isLoading: false,
  error: null,
  fetchedAt: null,

  fetchAll: async (options) => {
    const { mechanics, fetchedAt } = get();
    const cacheFresh = fetchedAt !== null && Date.now() - fetchedAt < MECHANICS_CACHE_TTL_MS;

    if (!options?.force && mechanics.length > 0 && cacheFresh) return;

    set({ isLoading: true, error: null });
    try {
      const mechanics = await mechanicService.getAllMechanics();
      set({ mechanics, fetchedAt: Date.now(), isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar mecânicos', isLoading: false });
    }
  },

  getById: async (id) => {
    return mechanicService.getMechanicById(id);
  },
}));
