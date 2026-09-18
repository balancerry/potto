'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateSettlement } from '@/lib/actions/transactions';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/core/constants/payment-methods';
import { toPaise, toRupees } from '@/lib/core/money';
import type { Member, PaymentMethod, Transaction } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function EditSettlementForm({
  potId,
  members,
  tx,
}: {
  potId: string;
  members: Member[];
  tx: Transaction;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active' || m.id === tx.paidBy || m.id === tx.toMember);
  const [fromMemberId, setFrom] = useState(tx.paidBy ?? '');
  const [toMemberId, setTo] = useState(tx.toMember ?? '');
  const [amount, setAmount] = useState(String(toRupees(tx.amount)));
  const [date, setDate] = useState(tx.date);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(tx.paymentMethod ?? '');
  const [note, setNote] = useState(tx.note ?? '');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    const result = await updateSettlement(potId, tx.id, {
      fromMemberId,
      toMemberId,
      amount: toPaise(n),
      date,
      paymentMethod: paymentMethod || undefined,
      note: note.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Settlement updated');
    router.push(`/pots/${potId}/transactions/${tx.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>From</Label>
          <select
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={fromMemberId}
            onChange={(e) => setFrom(e.target.value)}
          >
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>To</Label>
          <select
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={toMemberId}
            onChange={(e) => setTo(e.target.value)}
          >
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="amt">Amount (₹)</Label>
          <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Payment method</Label>
        <select
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | '')}
        >
          <option value="">Not specified</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Update settlement'}
      </Button>
    </form>
  );
}
