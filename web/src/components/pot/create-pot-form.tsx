'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createPot } from '@/lib/actions/pots';
import { toPaise } from '@/lib/core/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function parseRupees(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return toPaise(n);
}

export function CreatePotForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberNames, setMemberNames] = useState('');
  const [starting, setStarting] = useState('');
  const [expected, setExpected] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Enter a pot name');
      return;
    }

    const startingPaise = parseRupees(starting);
    if (starting.trim() && startingPaise === undefined) {
      toast.error('Enter a valid starting contribution');
      return;
    }
    const expectedPaise = parseRupees(expected);
    if (expected.trim() && expectedPaise === undefined) {
      toast.error('Enter a valid expected contribution');
      return;
    }

    setLoading(true);
    const result = await createPot({
      name: name.trim(),
      description: description.trim() || undefined,
      memberNames: memberNames
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean),
      startingContributionPaise: startingPaise,
      expectedContributionPaise: expectedPaise,
    });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Pot created');
    router.push(`/pots/${result.data.potId}`);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <Label htmlFor="name">Pot name *</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goa trip 2026"
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes for the group"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="members">Other members</Label>
        <Input
          id="members"
          value={memberNames}
          onChange={(e) => setMemberNames(e.target.value)}
          placeholder="Comma-separated names (optional)"
        />
        <p className="mt-1 text-xs text-ink-soft">You&apos;ll be added as admin automatically.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="starting">Starting contribution (₹)</Label>
          <Input
            id="starting"
            inputMode="decimal"
            value={starting}
            onChange={(e) => setStarting(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-ink-soft">Logged as your first contribution.</p>
        </div>
        <div>
          <Label htmlFor="expected">Expected per member (₹)</Label>
          <Input
            id="expected"
            inputMode="decimal"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="Optional"
          />
          <p className="mt-1 text-xs text-ink-soft">Informational target only.</p>
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? 'Creating…' : 'Create pot'}
      </Button>
    </form>
  );
}
