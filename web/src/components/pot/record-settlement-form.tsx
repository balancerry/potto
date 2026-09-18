'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { recordSettlement } from '@/lib/actions/transactions';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/lib/core/constants/payment-methods';
import { todayISO } from '@/lib/dates';
import { toPaise } from '@/lib/core/money';
import type { Member, PaymentMethod } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardTitle } from '@/components/ui/card';

export function RecordSettlementForm({
  potId,
  members,
  defaultFrom,
  defaultTo,
  defaultAmountPaise,
  onDone,
}: {
  potId: string;
  members: Member[];
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmountPaise?: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const [fromMemberId, setFrom] = useState(defaultFrom ?? active[0]?.id ?? '');
  const [toMemberId, setTo] = useState(defaultTo ?? active[1]?.id ?? active[0]?.id ?? '');
  const [amount, setAmount] = useState(
    defaultAmountPaise ? String(defaultAmountPaise / 100) : '',
  );
  const [date, setDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    const result = await recordSettlement(potId, {
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
    toast.success('Settlement recorded');
    onDone?.();
    router.refresh();
  }

  return (
    <Card>
      <CardTitle className="text-base">Record settlement</CardTitle>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
          {loading ? 'Saving…' : 'Record payment'}
        </Button>
      </form>
    </Card>
  );
}
