'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { archivePot, deletePot, updatePotDetails } from '@/lib/actions/pots';
import { toPaise, toRupees } from '@/lib/core/money';
import type { Pot } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function SettingsForm({ pot }: { pot: Pot }) {
  const router = useRouter();
  const [name, setName] = useState(pot.name);
  const [description, setDescription] = useState(pot.description ?? '');
  const [expected, setExpected] = useState(
    pot.expectedContributionPerMember != null
      ? String(toRupees(pot.expectedContributionPerMember))
      : '',
  );
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Enter a pot name');
      return;
    }

    let expectedPaise: number | null = null;
    if (expected.trim()) {
      const n = Number(expected);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('Enter a valid expected contribution');
        return;
      }
      expectedPaise = toPaise(n);
    }

    setSaving(true);
    const result = await updatePotDetails(pot.id, {
      name: name.trim(),
      description: description.trim() || null,
      expectedContributionPerMember: expectedPaise,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Settings saved');
    router.refresh();
  }

  async function onArchive() {
    if (!confirm('Archive this pot? Members can still view history, but it won’t accept new activity the same way.')) {
      return;
    }
    setArchiving(true);
    const result = await archivePot(pot.id);
    setArchiving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Pot archived');
    router.push('/');
    router.refresh();
  }

  async function onDelete() {
    if (!confirm('Permanently delete this pot and all of its transactions? This cannot be undone.')) {
      return;
    }
    setDeleting(true);
    const result = await deletePot(pot.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Pot deleted');
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Label htmlFor="expected">Expected contribution per member (₹)</Label>
          <Input
            id="expected"
            inputMode="decimal"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>

      {pot.status === 'active' ? (
        <Card className="border-neg/20">
          <CardTitle className="text-base text-neg">Archive pot</CardTitle>
          <CardDescription>
            Archiving marks the pot as finished. You can still open it from your list.
          </CardDescription>
          <Button variant="danger" className="mt-4" onClick={onArchive} disabled={archiving}>
            {archiving ? 'Archiving…' : 'Archive pot'}
          </Button>
        </Card>
      ) : (
        <Card>
          <CardTitle className="text-base">Archived</CardTitle>
          <CardDescription>This pot is already archived.</CardDescription>
        </Card>
      )}

      <Card className="border-neg/30">
        <CardTitle className="text-base text-neg">Delete pot</CardTitle>
        <CardDescription>
          Permanently removes the pot, members, transactions, and upcoming payments.
        </CardDescription>
        <Button variant="outline" className="mt-4 border-neg text-neg" onClick={onDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete permanently'}
        </Button>
      </Card>
    </div>
  );
}
