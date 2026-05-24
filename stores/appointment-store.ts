import { create } from 'zustand';
import { Appointment } from '@/types/models';
import * as appointmentService from '@/services/appointment-service';
import { useTimeSlotStore } from '@/stores/timeslot-store';

interface AppointmentState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  fetchByMechanic: (mechanicId: string) => Promise<void>;
  fetchByClient: (clientId: string) => Promise<void>;
  book: (data: appointmentService.BookAppointmentInput) => Promise<Appointment>;
  cancelByClient: (id: string) => Promise<void>;
  cancelByMechanic: (id: string) => Promise<void>;
  completeByMechanic: (data: appointmentService.CompleteAppointmentInput) => Promise<void>;
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
    useTimeSlotStore.getState().invalidateCache();
    set((state) => ({ appointments: [...state.appointments, appointment] }));
    return appointment;
  },

  cancelByClient: async (id) => {
    await appointmentService.cancelClientAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a)),
    }));
  },

  cancelByMechanic: async (id) => {
    await appointmentService.cancelMechanicAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a)),
    }));
  },

  completeByMechanic: async (data) => {
    await appointmentService.completeMechanicAppointment(data);
    set((state) => ({
      appointments: state.appointments.map((a) => (
        a.id === data.appointmentId
          ? {
              ...a,
              status: 'acabado',
              serviceSummary: data.summary,
              serviceDiagnosis: data.diagnosis,
              workPerformed: data.workPerformed,
              partsUsed: data.partsUsed,
              recommendations: data.recommendations,
              totalAmountCents: data.items.reduce((sum, item) => sum + item.amountCents, 0),
              closedAt: new Date().toISOString(),
              serviceItems: data.items,
            }
          : a
      )),
    }));
  },
}));
