'use server';

import { actionFail, actionOk } from '@/lib/errors';
import { requireUser } from '@/lib/actions/_helpers';

export async function markNotificationRead(notificationId: string) {
  const auth = await requireUser();
  if (!auth.user) return actionFail(auth.error);
  const { error } = await auth.supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) return actionFail(error);
  return actionOk();
}

export async function markAllNotificationsRead() {
  const auth = await requireUser();
  if (!auth.user) return actionFail(auth.error);
  const { error } = await auth.supabase.rpc('mark_all_notifications_read');
  if (error) return actionFail(error);
  return actionOk();
}
