'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { removeMember, updateMember } from '@/lib/actions/members';
import type { AccessLevel, JoinRequest, Member, MemberRole } from '@/lib/core/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MembersList({
  potId,
  members,
  pendingRequests,
  isAdmin,
}: {
  potId: string;
  members: Member[];
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
          <h3 className="font-display text-lg font-semibold text-ink">Pending join requests</h3>
          <ul className="grid gap-3">
            {pendingRequests.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-ink">{r.requestedName}</p>
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
        <h3 className="font-display text-lg font-semibold text-ink">Active members</h3>
        <ul className="grid gap-3">
          {active.map((m) => (
            <li key={m.id}>
              <Card className="p-4">
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
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{m.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge>{m.role}</Badge>
                          {m.accessLevel === 'view_only' ? <Badge tone="gold">View only</Badge> : null}
                          {!m.userId ? <Badge tone="default">Unlinked</Badge> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <Link href={`/pots/${potId}/balance?memberId=${m.id}`} className="text-accent hover:underline">
                          Balance
                        </Link>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="text-accent hover:underline"
                            onClick={() => setEditingId(m.id)}
                          >
                            Edit
                          </button>
                        ) : null}
                        {isAdmin && m.role !== 'admin' ? (
                          <button
                            type="button"
                            className="text-neg hover:underline"
                            onClick={() => void onRemove(m.id, m.name)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">Inactive</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {inactive.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 rounded-[var(--radius-md)] bg-surface-sunk px-3 py-2">
                <span>{m.name}</span>
                <Link href={`/pots/${potId}/balance?memberId=${m.id}`} className="text-accent">
                  Balance
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MemberEditForm({
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
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(member.accessLevel);
  const [saving, setSaving] = useState(false);

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
      role,
      accessLevel: role === 'admin' ? 'member' : accessLevel,
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
        <select
          id={`role-${member.id}`}
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
          value={role}
          onChange={(e) => {
            const next = e.target.value as MemberRole;
            setRole(next);
            if (next === 'admin') setAccessLevel('member');
          }}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
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
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void onSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
