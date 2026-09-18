'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addMoney, updateContribution } from '@/lib/actions/transactions';
import { todayISO } from '@/lib/dates';
import { toPaise, toRupees } from '@/lib/core/money';
import type { Member, Transaction } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Entry = { memberId: string; amountRupees: string };

export function AddMoneyForm({
  potId,
  members,
  defaultMemberId,
  editingTx,
}: {
  potId: string;
  members: Member[];
  defaultMemberId?: string;
  editingTx?: Transaction;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const isEdit = !!editingTx;

  const [date, setDate] = useState(editingTx?.date ?? todayISO());
  const [note, setNote] = useState(editingTx?.note ?? '');
  const [entries, setEntries] = useState<Entry[]>(
    isEdit
      ? [{ memberId: editingTx!.paidBy ?? defaultMemberId ?? active[0]?.id ?? '', amountRupees: String(toRupees(editingTx!.amount)) }]
      : [{ memberId: defaultMemberId ?? active[0]?.id ?? '', amountRupees: '' }],
  );
  const [loading, setLoading] = useState(false);

  function updateEntry(idx: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEdit) {
      const entry = entries[0];
      const amount = Number(entry.amountRupees);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Enter a valid amount');
        return;
      }
      setLoading(true);
      const result = await updateContribution(potId, editingTx!.id, {
        memberId: entry.memberId,
        amount: toPaise(amount),
        date,
        note: note.trim() || undefined,
      });
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Contribution updated');
      router.push(`/pots/${potId}/transactions/${editingTx!.id}`);
      router.refresh();
      return;
    }

    const parsed = entries
      .map((e) => ({ memberId: e.memberId, amount: Number(e.amountRupees) }))
      .filter((e) => e.memberId && Number.isFinite(e.amount) && e.amount > 0);

    if (parsed.length === 0) {
      toast.error('Add at least one contribution amount');
      return;
    }

    setLoading(true);
    const result = await addMoney(potId, {
      date,
      note: note.trim() || undefined,
      entries: parsed.map((e) => ({ memberId: e.memberId, amount: toPaise(e.amount) })),
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Money added');
    router.push(`/pots/${potId}/transactions`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-5">
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="space-y-3">
        <Label>Contributions</Label>
        {entries.map((entry, idx) => (
          <div key={idx} className="flex flex-col gap-2 sm:flex-row">
            <select
              className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm sm:flex-1"
              value={entry.memberId}
              onChange={(e) => updateEntry(idx, { memberId: e.target.value })}
              disabled={isEdit}
            >
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <Input
              inputMode="decimal"
              placeholder="Amount ₹"
              value={entry.amountRupees}
              onChange={(e) => updateEntry(idx, { amountRupees: e.target.value })}
              className="sm:w-36"
              required
            />
            {!isEdit && entries.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEntries((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ))}
        {!isEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setEntries((prev) => [...prev, { memberId: active[0]?.id ?? '', amountRupees: '' }])
            }
          >
            Add another member
          </Button>
        ) : null}
      </div>

      <div>
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : isEdit ? 'Update contribution' : 'Add money'}
      </Button>
    </form>
  );
}
