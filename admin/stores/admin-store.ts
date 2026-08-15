import { create } from 'zustand';
import { getDefaultFilters, sanitizeFilters } from '@/features/admin/filter-utils';
import * as adminService from '@/services/admin-service';
import { isApiError } from '@/services/api';
import { getApiErrorMessage } from '@/services/error-messages';
import {
  AdminAppointmentRow,
  AdminDashboardSummary,
  AdminFinancialReport,
  AdminFilters,
  AdminMechanicDetail,
  AdminMechanicRow,
  PaginatedResult,
} from '@/types/models';

type LoadKey = 'dashboard' | 'mechanics' | 'appointments' | 'finance' | 'detail' | 'deactivateMechanics' | 'createMechanic';

interface AdminState {
  filters: AdminFilters;
  dashboard: AdminDashboardSummary | null;
  mechanics: PaginatedResult<AdminMechanicRow>;
  appointments: PaginatedResult<AdminAppointmentRow>;
  finance: AdminFinancialReport | null;
  selectedMechanic: AdminMechanicDetail | null;
  loading: Record<LoadKey, boolean>;
  error: string | null;

  setFilters: (patch: Partial<AdminFilters>) => void;
  resetFilters: () => void;
  fetchDashboard: () => Promise<void>;
  fetchMechanics: (patch?: Partial<AdminFilters>) => Promise<void>;
  fetchAppointments: (patch?: Partial<AdminFilters>) => Promise<void>;
  fetchFinancialReport: (patch?: Partial<AdminFilters>) => Promise<void>;
  fetchMechanicDetail: (mechanicId: string) => Promise<void>;
  deactivateMechanics: (mechanicIds: string[]) => Promise<boolean>;
  createMechanic: (params: {
    name: string;
    phone: string;
    email: string;
    password: string;
    specialty: string;
    credentials: string;
  }) => Promise<boolean>;
  clearError: () => void;
}

const emptyPage = <T,>(): PaginatedResult<T> => ({
  rows: [],
  total: 0,
  page: 1,
  pageSize: 25,
});

function getAdminErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return getApiErrorMessage(error.code);
  return error instanceof Error ? error.message : fallback;
}

export const useAdminStore = create<AdminState>((set, get) => {
  const setLoading = (key: LoadKey, value: boolean) => {
    set((state) => ({ loading: { ...state.loading, [key]: value } }));
  };

  const run = async (key: LoadKey, task: () => Promise<void>) => {
    setLoading(key, true);
    set({ error: null });
    try {
      await task();
    } catch (error) {
      set({ error: getAdminErrorMessage(error, 'Falha na solicitação administrativa') });
    } finally {
      setLoading(key, false);
    }
  };

  return {
    filters: getDefaultFilters(),
    dashboard: null,
    mechanics: emptyPage<AdminMechanicRow>(),
    appointments: emptyPage<AdminAppointmentRow>(),
    finance: null,
    selectedMechanic: null,
    loading: {
      dashboard: false,
      mechanics: false,
      appointments: false,
      finance: false,
      detail: false,
      deactivateMechanics: false,
      createMechanic: false,
    },
    error: null,

    setFilters: (patch) => {
      set((state) => ({ filters: sanitizeFilters(patch, state.filters) }));
    },

    resetFilters: () => {
      set({ filters: getDefaultFilters() });
    },

    fetchDashboard: async () => {
      await run('dashboard', async () => {
        const dashboard = await adminService.fetchDashboardSummary(get().filters);
        set({ dashboard });
      });
    },

    fetchMechanics: async (patch) => {
      if (patch) get().setFilters(patch);
      await run('mechanics', async () => {
        const mechanics = await adminService.fetchMechanics(get().filters);
        set({ mechanics });
      });
    },

    fetchAppointments: async (patch) => {
      if (patch) get().setFilters(patch);
      await run('appointments', async () => {
        const appointments = await adminService.fetchAppointments(get().filters);
        set({ appointments });
      });
    },

    fetchFinancialReport: async (patch) => {
      if (patch) get().setFilters(patch);
      await run('finance', async () => {
        const finance = await adminService.fetchFinancialReport(get().filters);
        set({ finance });
      });
    },

    fetchMechanicDetail: async (mechanicId) => {
      await run('detail', async () => {
        const selectedMechanic = await adminService.fetchMechanicDetail(mechanicId, get().filters);
        set({ selectedMechanic });
      });
    },

    deactivateMechanics: async (mechanicIds) => {
      setLoading('deactivateMechanics', true);
      set({ error: null });
      try {
        await adminService.deactivateMechanics(mechanicIds);
        await get().fetchMechanics();
        await get().fetchDashboard();
        return true;
      } catch (error) {
        set({ error: getAdminErrorMessage(error, 'Falha ao excluir mecânicos') });
        return false;
      } finally {
        setLoading('deactivateMechanics', false);
      }
    },

    createMechanic: async (params) => {
      setLoading('createMechanic', true);
      set({ error: null });
      try {
        await adminService.createMechanic(params);
        await get().fetchMechanics();
        await get().fetchDashboard();
        return true;
      } catch (error) {
        set({ error: getAdminErrorMessage(error, 'Falha ao criar mecânico') });
        return false;
      } finally {
        setLoading('createMechanic', false);
      }
    },

    clearError: () => set({ error: null }),
  };
});
