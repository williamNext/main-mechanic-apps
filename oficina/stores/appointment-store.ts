import { create } from 'zustand';
import { Appointment } from '@/types/models';
import * as appointmentService from '@/services/appointment-service';
import { useNotificationStore } from '@/stores/notification-store';
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
    void useNotificationStore.getState().fetchUnreadCount(appointment.clientId);
    set((state) => ({ appointments: [...state.appointments, appointment] }));
    return appointment;
  },

  cancelByClient: async (id) => {
    const appointment = useAppointmentStore.getState().appointments.find((item) => item.id === id);
    await appointmentService.cancelClientAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    if (appointment?.clientId) void useNotificationStore.getState().fetchUnreadCount(appointment.clientId);
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a)),
    }));
  },

  cancelByMechanic: async (id) => {
    const appointment = useAppointmentStore.getState().appointments.find((item) => item.id === id);
    await appointmentService.cancelMechanicAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    if (appointment?.mechanicId) void useNotificationStore.getState().fetchUnreadCount(appointment.mechanicId);
    set((state) => ({
      appointments: state.appointments.map((a) => (a.id === id ? { ...a, status: 'cancelado' } : a)),
    }));
  },
}));
