'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createCommitment, updateCommitment } from '@/lib/actions/commitments';
import { todayISO } from '@/lib/dates';
import { toPaise, toRupees } from '@/lib/core/money';
import type { Commitment, PotCategory } from '@/lib/core/models';
import { CategoryPicker } from '@/components/categories/category-picker';
import { CancelLink, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { safePotReturn } from '@/lib/navigation/pot-trail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CommitmentForm({
  potId,
  editing,
  categories,
  canManageCategories,
}: {
  potId: string;
  editing?: Commitment;
  categories: PotCategory[];
  canManageCategories: boolean;
}) {
  const router = useRouter();
  const listPath = `/pots/${potId}/commitments`;
  const returnTo = safePotReturn(
    potId,
    useSearchParams().get('from'),
    editing ? `/pots/${potId}/commitments/${editing.id}` : listPath,
  );
  const [dirty, setDirty] = useState(false);
  useWarnUnsaved(dirty);
  const isEdit = !!editing;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [vendorName, setVendorName] = useState(editing?.vendorName ?? '');
  const [categoryId, setCategoryId] = useState<string | undefined>(editing?.categoryId);
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
      categoryId,
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
      toast.success('Planned payment updated');
      setDirty(false);
      router.push(returnTo);
      router.refresh();
      return;
    }

    const result = await createCommitment(potId, payload);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Planned payment added');
    setDirty(false);
    router.push(returnTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} onChange={() => setDirty(true)} className="mx-auto max-w-lg space-y-4">
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
        <CategoryPicker
          potId={potId}
          categories={categories}
          value={categoryId}
          onChange={(next) => {
            setCategoryId(next);
            setDirty(true);
          }}
          canManage={canManageCategories}
        />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add planned payment'}
        </Button>
        <CancelLink href={returnTo} dirty={dirty}>
          Cancel
        </CancelLink>
      </div>
    </form>
  );
}
