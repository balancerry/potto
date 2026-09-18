'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  addCommitmentPayment,
  createCommitmentWithPayment,
} from '@/lib/actions/commitments';
import { addExpense, updateExpense } from '@/lib/actions/transactions';
import {
  calculateCustomShares,
  calculateExpenseShares,
  calculatePercentageShares,
  validateSplit,
} from '@/lib/core/logic/accounting';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  deriveCommitmentStatus,
} from '@/lib/core/logic/commitments';
import { EXPENSE_CATEGORIES } from '@/lib/core/constants/categories';
import { todayISO } from '@/lib/dates';
import { formatMoney, toPaise, toRupees } from '@/lib/core/money';
import type {
  Commitment,
  CommitmentPayment,
  Member,
  PaymentSource,
  SplitMethod,
  Transaction,
} from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function AddExpenseForm({
  potId,
  members,
  defaultMemberId,
  editingTx,
  commitments,
  commitmentPayments,
  transactions,
  linkCommitmentId,
}: {
  potId: string;
  members: Member[];
  defaultMemberId?: string;
  editingTx?: Transaction;
  commitments: Commitment[];
  commitmentPayments: CommitmentPayment[];
  transactions: Transaction[];
  linkCommitmentId?: string;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const isEdit = !!editingTx;

  const linkable = commitments.filter((c) => {
    const paid = calculateCommitmentPaid(c.id, commitmentPayments, transactions);
    const status = deriveCommitmentStatus(c, paid);
    return status === 'planned' || status === 'partially_paid';
  });

  const [description, setDescription] = useState(editingTx?.description ?? '');
  const [amountRupees, setAmountRupees] = useState(
    editingTx ? String(toRupees(editingTx.amount)) : '',
  );
  const [paidBy, setPaidBy] = useState(editingTx?.paidBy ?? defaultMemberId ?? active[0]?.id ?? '');
  const [paymentSource, setPaymentSource] = useState<PaymentSource>(
    editingTx?.paymentSource ?? 'pool',
  );
  const [category, setCategory] = useState(editingTx?.category ?? '');
  const [date, setDate] = useState(editingTx?.date ?? todayISO());
  const [note, setNote] = useState(editingTx?.note ?? '');
  const [participantIds, setParticipantIds] = useState<string[]>(
    editingTx?.participants ?? active.map((m) => m.id),
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(editingTx?.splitMethod ?? 'equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of editingTx?.splits ?? []) {
      init[s.memberId] = String(toRupees(s.amount));
    }
    return init;
  });
  const [percentages, setPercentages] = useState<Record<string, string>>(() => {
    if (!editingTx?.amount || editingTx.splitMethod !== 'percentage') return {};
    const init: Record<string, string> = {};
    for (const s of editingTx.splits ?? []) {
      init[s.memberId] = String(Math.round((s.amount / editingTx.amount) * 1000) / 10);
    }
    return init;
  });
  const [commitmentMode, setCommitmentMode] = useState<'none' | 'link' | 'create'>(
    linkCommitmentId ? 'link' : 'none',
  );
  const [selectedCommitmentId, setSelectedCommitmentId] = useState(linkCommitmentId ?? linkable[0]?.id ?? '');
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentTotal, setNewCommitmentTotal] = useState('');
  const [loading, setLoading] = useState(false);

  const amountPaise = useMemo(() => {
    const n = Number(amountRupees);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return toPaise(n);
  }, [amountRupees]);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function buildSplits() {
    if (splitMethod === 'equal') {
      return calculateExpenseShares(amountPaise, participantIds);
    }
    if (splitMethod === 'custom') {
      const amounts: Record<string, number> = {};
      for (const id of participantIds) {
        amounts[id] = toPaise(Number(customAmounts[id] || 0));
      }
      return calculateCustomShares(amounts);
    }
    const pct: Record<string, number> = {};
    for (const id of participantIds) {
      pct[id] = Number(percentages[id] || 0);
    }
    return calculatePercentageShares(amountPaise, pct);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Enter a description');
      return;
    }
    if (amountPaise <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (participantIds.length === 0) {
      toast.error('Select at least one participant');
      return;
    }

    const splits = buildSplits();
    const rawPct =
      splitMethod === 'percentage'
        ? Object.fromEntries(participantIds.map((id) => [id, Number(percentages[id] || 0)]))
        : undefined;
    const valid = validateSplit(amountPaise, splitMethod, splits, rawPct);
    if (!valid.valid) {
      toast.error(valid.error ?? 'Invalid split');
      return;
    }

    const payload = {
      description: description.trim(),
      amount: amountPaise,
      paidBy,
      paymentSource,
      date,
      category: category || undefined,
      participants: participantIds,
      splitMethod,
      splits,
      note: note.trim() || undefined,
    };

    setLoading(true);

    if (isEdit) {
      const result = await updateExpense(potId, editingTx!.id, payload);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Expense updated');
      router.push(`/pots/${potId}/transactions/${editingTx!.id}`);
      router.refresh();
      return;
    }

    if (commitmentMode === 'link' && selectedCommitmentId) {
      const commitment = commitments.find((c) => c.id === selectedCommitmentId);
      if (commitment) {
        const remaining = calculateCommitmentRemaining(commitment, commitmentPayments, transactions);
        if (amountPaise > remaining) {
          setLoading(false);
          toast.error(`Payment exceeds remaining ${formatMoney(remaining)}`);
          return;
        }
      }
      const result = await addCommitmentPayment(potId, selectedCommitmentId, payload);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Payment recorded');
      router.push(`/pots/${potId}/commitments/${selectedCommitmentId}`);
      router.refresh();
      return;
    }

    if (commitmentMode === 'create') {
      const total = Number(newCommitmentTotal);
      if (!newCommitmentTitle.trim()) {
        setLoading(false);
        toast.error('Enter an upcoming payment title');
        return;
      }
      if (!Number.isFinite(total) || total <= 0) {
        setLoading(false);
        toast.error('Enter a valid total for the upcoming payment');
        return;
      }
      const result = await createCommitmentWithPayment(potId, {
        commitment: {
          title: newCommitmentTitle.trim(),
          totalAmount: toPaise(total),
          category: category || undefined,
        },
        payment: payload,
      });
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Expense and upcoming payment created');
      router.push(`/pots/${potId}/commitments/${result.data.commitmentId}`);
      router.refresh();
      return;
    }

    const result = await addExpense(potId, payload);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Expense added');
    router.push(`/pots/${potId}/transactions/${result.data.transactionId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5">
      <div>
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">Amount (₹) *</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={amountRupees}
            onChange={(e) => setAmountRupees(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="paidBy">Paid by</Label>
          <select
            id="paidBy"
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Payment source</Label>
          <div className="mt-1 flex gap-2">
            {(['pool', 'personal'] as const).map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setPaymentSource(src)}
                className={cn(
                  'h-11 flex-1 rounded-[var(--radius-md)] border text-sm font-medium capitalize',
                  paymentSource === src
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface text-ink',
                )}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Category</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? '' : c)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                category === c ? 'bg-accent text-white' : 'bg-surface-sunk text-ink-soft',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Participants</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {active.map((m) => {
            const on = participantIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleParticipant(m.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  on ? 'bg-accent text-white' : 'bg-surface-sunk text-ink-soft',
                )}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Split method</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['equal', 'custom', 'percentage'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSplitMethod(m)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium capitalize',
                splitMethod === m ? 'bg-accent text-white' : 'bg-surface-sunk text-ink-soft',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {splitMethod === 'custom' ? (
          <div className="mt-3 space-y-2">
            {participantIds.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span className="w-28 truncate text-sm">{active.find((m) => m.id === id)?.name}</span>
                <Input
                  inputMode="decimal"
                  placeholder="₹"
                  value={customAmounts[id] ?? ''}
                  onChange={(e) => setCustomAmounts((p) => ({ ...p, [id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : null}
        {splitMethod === 'percentage' ? (
          <div className="mt-3 space-y-2">
            {participantIds.map((id) => (
              <div key={id} className="flex items-center gap-2">
                <span className="w-28 truncate text-sm">{active.find((m) => m.id === id)?.name}</span>
                <Input
                  inputMode="decimal"
                  placeholder="%"
                  value={percentages[id] ?? ''}
                  onChange={(e) => setPercentages((p) => ({ ...p, [id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : null}
        {splitMethod === 'equal' && amountPaise > 0 && participantIds.length > 0 ? (
          <p className="mt-2 text-xs text-ink-soft">
            ≈ {formatMoney(Math.floor(amountPaise / participantIds.length))} each
          </p>
        ) : null}
      </div>

      {!isEdit ? (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-line p-4">
          <Label>Link to upcoming payment</Label>
          <div className="flex flex-wrap gap-2">
            {(['none', 'link', 'create'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCommitmentMode(m)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  commitmentMode === m ? 'bg-accent text-white' : 'bg-surface-sunk text-ink-soft',
                )}
              >
                {m === 'none' ? 'No link' : m === 'link' ? 'Link existing' : 'Create + pay'}
              </button>
            ))}
          </div>
          {commitmentMode === 'link' ? (
            linkable.length === 0 ? (
              <p className="text-sm text-ink-soft">No open upcoming payments to link.</p>
            ) : (
              <select
                className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
                value={selectedCommitmentId}
                onChange={(e) => setSelectedCommitmentId(e.target.value)}
              >
                {linkable.map((c) => {
                  const rem = calculateCommitmentRemaining(c, commitmentPayments, transactions);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.title} · {formatMoney(rem)} left
                    </option>
                  );
                })}
              </select>
            )
          ) : null}
          {commitmentMode === 'create' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ctitle">Title</Label>
                <Input
                  id="ctitle"
                  value={newCommitmentTitle}
                  onChange={(e) => setNewCommitmentTitle(e.target.value)}
                  placeholder="Hotel deposit"
                />
              </div>
              <div>
                <Label htmlFor="ctotal">Total (₹)</Label>
                <Input
                  id="ctotal"
                  inputMode="decimal"
                  value={newCommitmentTotal}
                  onChange={(e) => setNewCommitmentTotal(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : isEdit ? 'Update expense' : 'Add expense'}
      </Button>
    </form>
  );
}
