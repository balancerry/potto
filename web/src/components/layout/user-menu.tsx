'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';
import { initials } from '@/lib/core/money';
import { cn } from '@/lib/utils';

export function UserMenu({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const displayName = userName?.trim() || 'Member';
  const avatar = initials(displayName);

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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent px-1.5 py-1 text-left transition-colors',
          'hover:border-line hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        )}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white"
        >
          {avatar}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium text-ink">{displayName}</span>
          {userEmail ? <span className="block truncate text-xs text-ink-soft">{userEmail}</span> : null}
        </span>
        <ChevronDown className={cn('hidden size-4 text-ink-soft sm:block', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface shadow-lg"
        >
          <div className="border-b border-line px-3 py-3 sm:hidden">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            {userEmail ? <p className="truncate text-xs text-ink-soft">{userEmail}</p> : null}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none"
            >
              <LogOut className="size-4 text-ink-soft" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
