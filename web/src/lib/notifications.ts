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

export type NotificationRow = {
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

/** Web deep-link for a notification. */
export function notificationHref(n: AppNotification): string | null {
  if (!n.potId) return null;
  if (n.type === 'join_request_pending') {
    const requestId = typeof n.data.join_request_id === 'string' ? n.data.join_request_id : null;
    if (requestId) return `/pots/${n.potId}/join-requests/${requestId}`;
    return `/pots/${n.potId}/members`;
  }
  if (n.type === 'transaction_created') {
    return `/pots/${n.potId}`;
  }
  return `/pots/${n.potId}`;
}
