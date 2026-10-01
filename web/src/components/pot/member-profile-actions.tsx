'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { removeMember } from '@/lib/actions/members';
import type { Member } from '@/lib/core/models';
import { MemberEditForm } from '@/components/pot/members-list';

export function MemberProfileActions({
  potId,
  member,
  canEdit,
  canRemove,
  canLink,
  children,
}: {
  potId: string;
  member: Member;
  canEdit: boolean;
  canRemove: boolean;
  canLink: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hasActions = canEdit || canRemove || canLink;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onRemove() {
    if (!confirm(`Remove ${member.name} from this pot? Their history stays for balances.`)) return;
    const result = await removeMember(potId, member.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member removed');
    router.push(`/pots/${potId}/members`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        {hasActions ? (
          <div className="relative" ref={rootRef}>
            <button
              type="button"
              aria-label="Member actions"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-lg text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              ⋮
            </button>
            {open ? (
              <div
                id={menuId}
                role="menu"
                aria-label="Member actions"
                className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-sm"
              >
                {canEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-surface-sunk"
                    onClick={() => {
                      setOpen(false);
                      setEditing(true);
                    }}
                  >
                    Edit member
                  </button>
                ) : null}
                {canLink ? (
                  <Link
                    role="menuitem"
                    href={`/pots/${potId}/invite`}
                    className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-surface-sunk"
                    onClick={() => setOpen(false)}
                  >
                    Link account
                  </Link>
                ) : null}
                {canRemove ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-neg hover:bg-surface-sunk"
                    onClick={() => {
                      setOpen(false);
                      void onRemove();
                    }}
                  >
                    Remove from Pot
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing && canEdit ? (
        <div className="max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <MemberEditForm
            member={member}
            potId={potId}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
