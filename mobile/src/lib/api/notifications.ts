import { supabase } from '@/lib/supabase';

export type NotificationType =
  | 'join_request_pending'
  | 'join_request_approved'
  | 'join_request_rejected'
  | 'transaction_created';

export type AppNotification = {
  id: string;
  userId: string;
  potId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  pot_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    potId: row.pot_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function notificationHref(n: AppNotification): string | null {
  if (!n.potId) return null;
  if (n.type === 'join_request_pending') {
    const requestId = typeof n.data.join_request_id === 'string' ? n.data.join_request_id : null;
    if (requestId) return `/pot/${n.potId}/join-requests/${requestId}`;
    return `/pot/${n.potId}/settings`;
  }
  if (n.type === 'transaction_created') {
    const txId = typeof n.data.transaction_id === 'string' ? n.data.transaction_id : null;
    if (txId) return `/pot/${n.potId}/transaction/${txId}`;
    return `/pot/${n.potId}`;
  }
  return `/pot/${n.potId}`;
}

const LIMIT = 50;

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return ((data as NotificationRow[] | null) ?? []).map(mapNotification);
}

export async function markNotificationReadRemote(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsReadRemote(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export { type NotificationRow };
