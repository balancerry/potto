'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createCommitment, updateCommitment } from '@/lib/actions/commitments';
import { EXPENSE_CATEGORIES } from '@/lib/core/constants/categories';
import { todayISO } from '@/lib/dates';
import { toPaise, toRupees } from '@/lib/core/money';
import type { Commitment } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function CommitmentForm({
  potId,
  editing,
}: {
  potId: string;
  editing?: Commitment;
}) {
  const router = useRouter();
  const isEdit = !!editing;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [vendorName, setVendorName] = useState(editing?.vendorName ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [total, setTotal] = useState(editing ? String(toRupees(editing.totalAmount)) : '');
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(total);
    if (!title.trim()) {
      toast.error('Enter a title');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a valid total amount');
      return;
    }

    const payload = {
      title: title.trim(),
      vendorName: vendorName.trim() || undefined,
      category: category || undefined,
      description: description.trim() || undefined,
      totalAmount: toPaise(n),
      dueDate: dueDate || null,
    };

    setLoading(true);
    if (isEdit) {
      const result = await updateCommitment(potId, editing!.id, payload);
      setLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Updated');
      router.push(`/pots/${potId}/commitments/${editing!.id}`);
      router.refresh();
      return;
    }

    const result = await createCommitment(potId, payload);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Upcoming payment created');
    router.push(`/pots/${potId}/commitments/${result.data.commitmentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="total">Total amount (₹) *</Label>
          <Input id="total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="due">Due date</Label>
          <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={todayISO()} />
        </div>
      </div>
      <div>
        <Label htmlFor="vendor">Vendor</Label>
        <Input id="vendor" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
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
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Create upcoming payment'}
      </Button>
    </form>
  );
}
