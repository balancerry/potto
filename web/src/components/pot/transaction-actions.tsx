'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteTransaction } from '@/lib/actions/transactions';
import { Button, ButtonLink } from '@/components/ui/button';

export function TransactionActions({
  potId,
  txId,
  type,
  canEdit,
  canDelete,
}: {
  potId: string;
  txId: string;
  type: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();

  async function onDelete() {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    const result = await deleteTransaction(potId, txId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Deleted');
    router.push(`/pots/${potId}/transactions`);
    router.refresh();
  }

  const editHref =
    type === 'contribution'
      ? `/pots/${potId}/add-money?editId=${txId}`
      : type === 'settlement'
        ? `/pots/${potId}/edit-settlement?txId=${txId}`
        : `/pots/${potId}/add-expense?editId=${txId}`;

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit ? (
        <ButtonLink href={editHref} variant="outline" size="sm">
          Edit
        </ButtonLink>
      ) : null}
      {canDelete ? (
        <Button variant="danger" size="sm" onClick={() => void onDelete()}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}
