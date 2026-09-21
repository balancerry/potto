import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  type AppNotification,
  type NotificationRow,
  fetchNotifications,
  mapNotification,
  markAllNotificationsReadRemote,
  markNotificationReadRemote,
} from '@/lib/api/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { usePottoStore } from '@/store/PottoStore';

type NotificationsContextValue = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { reloadWorkspace } = usePottoStore();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleWorkspaceReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      void reloadWorkspace().catch(() => undefined);
    }, 400);
  }, [reloadWorkspace]);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await fetchNotifications());
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user) {
      setItems([]);
      return;
    }

    void refresh();

    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev;
            return [mapNotification(row), ...prev];
          });
          scheduleWorkspaceReload();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow;
          setItems((prev) => prev.map((n) => (n.id === row.id ? mapNotification(row) : n)));
        },
      )
      .subscribe();

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [session?.user, refresh, scheduleWorkspaceReload]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)),
    );
    try {
      await markNotificationReadRemote(id);
    } catch {
      await refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt: now })));
    try {
      await markAllNotificationsReadRemote();
    } catch {
      await refresh();
    }
  }, [refresh]);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
