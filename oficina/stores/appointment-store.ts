import { create } from 'zustand';
import { Appointment, BookAppointmentInput } from '@main-mechanic/types';
import * as appointmentService from '@/services/appointment-service';
import { useNotificationStore } from '@/stores/notification-store';
import { useTimeSlotStore } from '@/stores/timeslot-store';

interface AppointmentState {
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  loadedAppointmentId: string | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;

  fetchByClient: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  book: (data: BookAppointmentInput) => Promise<Appointment>;
  cancelByClient: (id: string) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  selectedAppointment: null,
  loadedAppointmentId: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,

  fetchByClient: async () => {
    set({ isLoading: true, error: null });
    try {
      const appointments = await appointmentService.getAppointmentsByClient();
      set({ appointments, isLoading: false });
    } catch {
      set({ error: 'Falha ao carregar reservas', isLoading: false });
    }
  },

  fetchById: async (id) => {
    set({ selectedAppointment: null, loadedAppointmentId: null, isDetailLoading: true, error: null });
    try {
      const selectedAppointment = await appointmentService.getAppointmentById(id);
      set({ selectedAppointment, loadedAppointmentId: id, isDetailLoading: false });
    } catch {
      set({ loadedAppointmentId: id, error: 'Falha ao carregar agendamento', isDetailLoading: false });
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
    const appointment = await appointmentService.cancelClientAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    void useNotificationStore.getState().fetchUnreadCount(appointment.clientId);
    set((state) => ({
      appointments: state.appointments.map((item) => (item.id === id ? appointment : item)),
      selectedAppointment: state.selectedAppointment?.id === id ? appointment : state.selectedAppointment,
    }));
  },
}));
