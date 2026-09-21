'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import {
  type AppNotification,
  type NotificationRow,
  mapNotification,
  notificationHref,
} from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/core/money';

const LIMIT = 30;

function relativeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const supabase = useMemo(() => createClient(), []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) {
      console.error('[notifications]', error.message);
      setLoading(false);
      return;
    }
    setItems((data as NotificationRow[] | null)?.map(mapNotification) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await load();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      channel = supabase
        .channel(`notifications-bell:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as NotificationRow;
            setItems((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev;
              return [mapNotification(row), ...prev].slice(0, LIMIT);
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as NotificationRow;
            setItems((prev) => prev.map((n) => (n.id === row.id ? mapNotification(row) : n)));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onOpenItem = (n: AppNotification) => {
    setOpen(false);
    if (n.readAt) return;
    startTransition(async () => {
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)),
      );
      await markNotificationRead(n.id);
    });
  };

  const onMarkAll = () => {
    if (unreadCount === 0) return;
    startTransition(async () => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt: now })));
      await markAllNotificationsRead();
    });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex size-10 items-center justify-center rounded-[var(--radius-md)] border border-transparent text-ink transition-colors',
          'hover:border-line hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
          open && 'border-line bg-surface',
        )}
      >
        <Bell className="size-5" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAll}
                disabled={pending}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-ink-soft">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-soft">You’re all caught up</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const href = notificationHref(n);
                  const content = (
                    <span className="flex items-start gap-2">
                      {!n.readAt ? (
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      ) : (
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm text-ink', !n.readAt && 'font-medium')}>{n.title}</span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-ink-soft/80">{relativeLabel(n.createdAt)}</span>
                      </span>
                    </span>
                  );

                  return (
                    <li key={n.id} className="border-b border-line last:border-b-0">
                      {href ? (
                        <Link
                          href={href}
                          role="menuitem"
                          onClick={() => onOpenItem(n)}
                          className={cn(
                            'block px-3 py-2.5 transition-colors hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none',
                            !n.readAt && 'bg-accent-soft/40',
                          )}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => onOpenItem(n)}
                          className={cn(
                            'w-full px-3 py-2.5 text-left transition-colors hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none',
                            !n.readAt && 'bg-accent-soft/40',
                          )}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
