'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { archivePot } from '@/lib/actions/pots';
import type { PotListPermissions } from '@/lib/queries/pots';
import { cn } from '@/lib/utils';

export function PotCardMenu({
  potId,
  potName,
  permissions,
}: {
  potId: string;
  potName: string;
  permissions: PotListPermissions;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const router = useRouter();

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

  function onArchive() {
    if (
      !confirm(
        `Archive “${potName}”? Members can still view history, but new activity is limited.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await archivePot(potId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Pot archived');
      setOpen(false);
      router.refresh();
    });
  }

  const items: { href?: string; label: string; onClick?: () => void; danger?: boolean }[] = [
    { href: `/pots/${potId}`, label: 'Open pot' },
    { href: `/pots/${potId}/summary`, label: 'Pot summary' },
  ];
  if (permissions.canInvite) items.push({ href: `/pots/${potId}/invite`, label: 'Invite' });
  if (permissions.canEditPot) items.push({ href: `/pots/${potId}/settings`, label: 'Settings' });
  if (permissions.canArchive) items.push({ label: 'Archive', onClick: onArchive, danger: true });

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Actions for ${potName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-soft transition-colors',
          'hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
          open && 'bg-surface-sunk text-ink',
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className="block px-3 py-2 text-sm text-ink hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={item.onClick}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none disabled:opacity-50',
                  item.danger ? 'text-neg' : 'text-ink',
                )}
              >
                {pending && item.danger ? 'Archiving…' : item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
