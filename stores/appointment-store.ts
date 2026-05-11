import { create } from 'zustand';
import { Appointment, AppointmentStatus } from '@/types/models';
import * as appointmentService from '@/services/appointment-service';

interface AppointmentState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  fetchByMechanic: (mechanicId: string) => Promise<void>;
  fetchByClient: (clientId: string) => Promise<void>;
  book: (data: Omit<Appointment, 'id' | 'createdAt' | 'status'>) => Promise<Appointment>;
  updateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const appointments = await appointmentService.getAllAppointments();
      set({ appointments, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar agendamentos', isLoading: false });
    }
  },

  fetchByMechanic: async (mechanicId) => {
    set({ isLoading: true, error: null });
    try {
      const appointments = await appointmentService.getAppointmentsByMechanic(mechanicId);
      set({ appointments, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar agenda', isLoading: false });
    }
  },

  fetchByClient: async (clientId) => {
    set({ isLoading: true, error: null });
    try {
      const appointments = await appointmentService.getAppointmentsByClient(clientId);
      set({ appointments, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar reservas', isLoading: false });
    }
  },

  book: async (data) => {
    const appointment = await appointmentService.createAppointment(data);
    set((state) => ({ appointments: [...state.appointments, appointment] }));
    return appointment;
  },

  updateStatus: async (id, status) => {
    await appointmentService.updateAppointmentStatus(id, status);
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  },
}));
