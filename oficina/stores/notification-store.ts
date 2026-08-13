import { create } from 'zustand';
import { AppNotification } from '@/types/models';
import * as notificationService from '@/services/notification-service';

interface NotificationState {
  notifications: AppNotification[];
  activeRecipientId: string | null;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetch: (recipientId: string) => Promise<void>;
  fetchUnreadCount: (recipientId: string) => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: (recipientId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  activeRecipientId: null,
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetch: async (recipientId) => {
    set({ isLoading: true, error: null });
    try {
      const notifications = await notificationService.getNotifications();
      set({
        notifications,
        activeRecipientId: recipientId,
        unreadCount: notifications.filter((item) => !item.readAt).length,
        isLoading: false,
      });
    } catch {
      set({ error: 'Falha ao carregar notificacoes', isLoading: false });
    }
  },

  fetchUnreadCount: async (recipientId) => {
    try {
      if (get().activeRecipientId === recipientId) {
        const notifications = await notificationService.getNotifications();
        set({
          notifications,
          unreadCount: notifications.filter((item) => !item.readAt).length,
        });
        return;
      }

      const unreadCount = await notificationService.getUnreadNotificationCount();
      set({ unreadCount });
    } catch {
      set({ error: 'Falha ao carregar notificacoes' });
    }
  },

  markRead: async (notificationId) => {
    await notificationService.markNotificationRead(notificationId);
    set((state) => ({
      notifications: state.notifications.map((item) => (
        item.id === notificationId && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item
      )),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: async (recipientId) => {
    await notificationService.markAllNotificationsRead();
    const now = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, readAt: item.readAt ?? now })),
      unreadCount: 0,
    }));
  },
}));
