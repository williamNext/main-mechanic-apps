import { create } from 'zustand';
import { Mechanic } from '@/types/models';
import * as mechanicService from '@/services/mechanic-service';

interface MechanicState {
  mechanics: Mechanic[];
  isLoading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  getById: (id: string) => Promise<Mechanic | null>;
  addMechanic: (data: Omit<Mechanic, 'id' | 'createdAt' | 'role'>) => Promise<Mechanic>;
  editMechanic: (id: string, data: Partial<Mechanic>) => Promise<void>;
  removeMechanic: (id: string) => Promise<void>;
}

export const useMechanicStore = create<MechanicState>((set, get) => ({
  mechanics: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const mechanics = await mechanicService.getAllMechanics();
      set({ mechanics, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar mecânicos', isLoading: false });
    }
  },

  getById: async (id) => {
    return mechanicService.getMechanicById(id);
  },

  addMechanic: async (data) => {
    const mechanic = await mechanicService.createMechanic(data);
    set((state) => ({ mechanics: [...state.mechanics, mechanic] }));
    return mechanic;
  },

  editMechanic: async (id, data) => {
    const updated = await mechanicService.updateMechanic(id, data);
    if (updated) {
      set((state) => ({
        mechanics: state.mechanics.map((m) => (m.id === id ? updated : m)),
      }));
    }
  },

  removeMechanic: async (id) => {
    await mechanicService.deleteMechanic(id);
    set((state) => ({
      mechanics: state.mechanics.filter((m) => m.id !== id),
    }));
  },
}));
