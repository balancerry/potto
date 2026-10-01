'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { removeMember, updateMember } from '@/lib/actions/members';
import { calculateMemberContributed } from '@/lib/core/logic/accounting';
import { formatMoney } from '@/lib/core/money';
import type { AccessLevel, JoinRequest, Member, MemberRole, Transaction } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { UnsavedDialog, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function roleLabel(role: MemberRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

function isPrivilegedRole(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function MembersList({
  potId,
  members,
  transactions,
  pendingRequests,
  isAdmin,
}: {
  potId: string;
  members: Member[];
  transactions: Transaction[];
  pendingRequests: JoinRequest[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const inactive = members.filter((m) => m.status === 'inactive');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function onRemove(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this pot? Their history stays for balances.`)) return;
    const result = await removeMember(potId, memberId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member removed');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {isAdmin && pendingRequests.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-sans text-lg font-semibold text-ink">Pending join requests</h3>
          <ul className="grid gap-3">
            {pendingRequests.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-ink">{r.requestedName}</p>
                    <p className="text-xs text-ink-soft">Waiting for review</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/pots/${potId}/join-requests/${r.id}`)}
                  >
                    Review
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="sr-only">Active members</h3>
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {active.map((m) => (
            <li key={m.id} className="px-3 py-2">
              {editingId === m.id && isAdmin ? (
                <MemberEditForm
                  member={m}
                  potId={potId}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href={`/pots/${potId}/balance?memberId=${m.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] py-1 hover:bg-surface-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold text-ink">{m.name}</span>
                        <span className="shrink-0 text-xs text-ink-soft">{roleLabel(m.role)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-ink-soft">
                        Contributed {formatMoney(calculateMemberContributed(transactions, m.id))}
                        {m.accessLevel === 'view_only' ? ' · View only' : ''}
                        {!m.userId ? ' · Unlinked' : ''}
                      </span>
                    </span>
                  </Link>
                  <MemberMenu
                    canEdit={isAdmin}
                    canRemove={isAdmin && !isPrivilegedRole(m.role)}
                    showLink={!m.userId}
                    onEdit={() => setEditingId(m.id)}
                    onRemove={() => void onRemove(m.id, m.name)}
                    transactionsHref={`/pots/${potId}/transactions?member=${m.id}`}
                    linkHref={`/pots/${potId}/invite`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-sans text-lg font-semibold text-ink">Inactive</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {inactive.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 rounded-[var(--radius-md)] bg-surface-sunk px-3 py-2">
                <span>{m.name}</span>
                <Link href={`/pots/${potId}/balance?memberId=${m.id}`} className="text-accent hover:underline">
                  View details
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MemberMenu({
  canEdit,
  canRemove,
  showLink,
  onEdit,
  onRemove,
  transactionsHref,
  linkHref,
}: {
  canEdit: boolean;
  canRemove: boolean;
  showLink: boolean;
  onEdit: () => void;
  onRemove: () => void;
  transactionsHref: string;
  linkHref: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Member actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-lg text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ⋮
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-md)] border border-line bg-surface p-1 shadow-lg"
        >
          <Link role="menuitem" href={transactionsHref} className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-surface-sunk" onClick={() => setOpen(false)}>
            View transactions
          </Link>
          {showLink ? (
            <Link role="menuitem" href={linkHref} className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm hover:bg-surface-sunk" onClick={() => setOpen(false)}>
              Link account
            </Link>
          ) : null}
          {canEdit ? (
            <button type="button" role="menuitem" className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm hover:bg-surface-sunk" onClick={() => { setOpen(false); onEdit(); }}>
              Edit member
            </button>
          ) : null}
          {canRemove ? (
            <button type="button" role="menuitem" className="block w-full rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm text-neg hover:bg-surface-sunk" onClick={() => { setOpen(false); onRemove(); }}>
              Remove member
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MemberEditForm({
  member,
  potId,
  onDone,
  onCancel,
}: {
  member: Member;
  potId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isOwnerMember = member.role === 'owner';
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<MemberRole>(member.role === 'owner' ? 'owner' : member.role);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(member.accessLevel);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty =
    name !== member.name ||
    role !== (member.role === 'owner' ? 'owner' : member.role) ||
    accessLevel !== member.accessLevel;
  useWarnUnsaved(dirty && !saving);

  function requestCancel() {
    if (dirty) setConfirmLeave(true);
    else onCancel();
  }

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a display name');
      return;
    }
    setSaving(true);
    const result = await updateMember({
      potId,
      memberId: member.id,
      displayName: trimmed,
      ...(isOwnerMember
        ? {}
        : {
            role: role === 'admin' ? 'admin' : 'member',
            accessLevel: role === 'admin' ? 'member' : accessLevel,
          }),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member updated');
    onDone();
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`name-${member.id}`}>Display name</Label>
        <Input id={`name-${member.id}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`role-${member.id}`}>Role</Label>
        {isOwnerMember ? (
          <>
            <Input id={`role-${member.id}`} value="Owner" disabled />
            <p className="mt-1 text-xs text-ink-soft">Ownership cannot be transferred.</p>
          </>
        ) : (
          <select
            id={`role-${member.id}`}
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={role === 'owner' ? 'admin' : role}
            onChange={(e) => {
              const next = e.target.value as 'admin' | 'member';
              setRole(next);
              if (next === 'admin') setAccessLevel('member');
            }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        )}
      </div>
      {!isOwnerMember ? (
        <div>
          <Label htmlFor={`access-${member.id}`}>Access</Label>
          <select
            id={`access-${member.id}`}
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={role === 'admin' ? 'member' : accessLevel}
            disabled={role === 'admin'}
            onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
          >
            <option value="member">Full member</option>
            <option value="view_only">View only</option>
          </select>
          {role === 'admin' ? (
            <p className="mt-1 text-xs text-ink-soft">Admins always have full member access.</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={requestCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
      <UnsavedDialog open={confirmLeave} onStay={() => setConfirmLeave(false)} onDiscard={onCancel} />
    </div>
  );
}
