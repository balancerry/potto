'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { assignPoolManager } from '@/lib/actions/pool';
import type { Member } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function PoolManagerSettings({
  potId,
  members,
  poolManagerMemberId,
  canChange,
}: {
  potId: string;
  members: Member[];
  poolManagerMemberId: string | null;
  canChange: boolean;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const manager = members.find((m) => m.id === poolManagerMemberId);
  const [memberId, setMemberId] = useState(poolManagerMemberId ?? active[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error("You're offline. Changes will not be saved until you're back online.");
      return;
    }
    setSaving(true);
    const result = await assignPoolManager(potId, memberId);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Pool manager updated');
    setEditing(false);
    router.refresh();
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Pool manager</CardTitle>
      <CardDescription>The person who looks after the group&apos;s collected money.</CardDescription>
      <p className="font-semibold text-ink">{manager?.name ?? 'Not assigned'}</p>
      {canChange && !editing ? (
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>
          Change pool manager
        </Button>
      ) : null}
      {canChange && editing ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
