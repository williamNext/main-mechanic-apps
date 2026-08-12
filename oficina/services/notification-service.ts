import { supabase } from './legacy-supabase-client';
import { AppNotification } from '@/types/models';

function mapNotificationRow(row: any): AppNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    appointmentId: row.appointment_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getNotifications(recipientId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map(mapNotificationRow);
}

export async function getUnreadNotificationCount(recipientId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('read_at', null);

  if (error) throw error;

  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now, updated_at: now })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) throw error;
}

export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now, updated_at: now })
    .eq('recipient_id', recipientId)
    .is('read_at', null);

  if (error) throw error;
}
