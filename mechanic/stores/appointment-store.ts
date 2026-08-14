import { create } from 'zustand';
import { Appointment } from '@/types/models';
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

  fetchAll: () => Promise<void>;
  fetchByMechanic: () => Promise<void>;
  fetchByClient: (clientId: string) => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  book: (data: appointmentService.BookAppointmentInput) => Promise<Appointment>;
  cancelByClient: (id: string) => Promise<void>;
  cancelByMechanic: (id: string) => Promise<void>;
  completeByMechanic: (data: appointmentService.CompleteAppointmentInput) => Promise<void>;
}

export const useAppointmentStore = create<AppointmentState>((set) => ({
  appointments: [],
  selectedAppointment: null,
  loadedAppointmentId: null,
  isLoading: false,
  isDetailLoading: false,
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

  fetchByMechanic: async () => {
    set({ isLoading: true, error: null });
    try {
      const appointments = await appointmentService.getAppointmentsByMechanic();
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
    const updatedAppointment = await appointmentService.cancelMechanicAppointment(id);
    useTimeSlotStore.getState().invalidateCache();
    if (appointment?.mechanicId) void useNotificationStore.getState().fetchUnreadCount(appointment.mechanicId);
    set((state) => ({
      appointments: state.appointments.map((item) => (item.id === id ? updatedAppointment : item)),
      selectedAppointment: state.selectedAppointment?.id === id
        ? updatedAppointment
        : state.selectedAppointment,
    }));
  },

  completeByMechanic: async (data) => {
    const updatedAppointment = await appointmentService.completeMechanicAppointment(data);
    set((state) => ({
      appointments: state.appointments.map((item) => (
        item.id === data.appointmentId ? updatedAppointment : item
      )),
      selectedAppointment: state.selectedAppointment?.id === data.appointmentId
        ? updatedAppointment
        : state.selectedAppointment,
    }));
  },
}));
