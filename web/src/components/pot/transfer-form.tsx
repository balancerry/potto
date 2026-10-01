'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { transferPoolMoney } from '@/lib/actions/pool';
import { todayISO } from '@/lib/dates';
import { calculateAccountBalance } from '@/lib/core/logic/pool-money';
import { formatMoney, toPaise } from '@/lib/core/money';
import type { PoolAccount, Transaction } from '@/lib/core/models';
import { CancelLink, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function TransferForm({
  potId,
  accounts,
  transactions,
}: {
  potId: string;
  accounts: PoolAccount[];
  transactions: Transaction[];
}) {
  const router = useRouter();
  const poolPath = `/pots/${potId}/pool`;
  const [dirty, setDirty] = useState(false);
  useWarnUnsaved(dirty);
  const active = accounts.filter((a) => a.active);
  const bank = active.find((a) => a.type === 'bank');
  const cash = active.find((a) => a.type === 'cash');
  const [fromId, setFromId] = useState(bank?.id ?? active[0]?.id ?? '');
  const [toId, setToId] = useState(cash?.id ?? active[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);

  const sourceBalance = fromId ? calculateAccountBalance(transactions, fromId) : 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error("You're offline. Changes will not be saved until you're back online.");
      return;
    }
    const paise = toPaise(Number(amount));
    if (!fromId || !toId) {
      toast.error('Choose both accounts');
      return;
    }
    if (fromId === toId) {
      toast.error('Choose two different pool accounts');
      return;
    }
    if (!Number.isFinite(paise) || paise <= 0) {
      toast.error('Enter an amount greater than zero');
      return;
    }
    if (paise > sourceBalance) {
      toast.error('Not enough money in that pool account');
      return;
    }
    setLoading(true);
    const result = await transferPoolMoney(potId, {
      fromAccountId: fromId,
      toAccountId: toId,
      amount: paise,
      date,
      note: note.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Money transferred');
    setDirty(false);
    router.push(poolPath);
  }

  return (
    <form onSubmit={onSubmit} onChange={() => setDirty(true)} className="mx-auto max-w-lg space-y-5">
      <div>
        <Label htmlFor="from">From</Label>
        <select
          id="from"
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
        >
          {active.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatMoney(calculateAccountBalance(transactions, a.id))})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="to">To</Label>
        <select
          id="to"
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
          value={toId}
          onChange={(e) => setToId(e.target.value)}
        >
          {active.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="amount">Amount</Label>
        <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Transferring…' : 'Transfer'}
        </Button>
        <CancelLink href={poolPath} dirty={dirty}>
          Cancel
        </CancelLink>
      </div>
    </form>
  );
}
