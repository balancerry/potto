'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteTransaction } from '@/lib/actions/transactions';
import { Button, ButtonLink } from '@/components/ui/button';
import { withReturn } from '@/lib/navigation/pot-trail';

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
  }

  const txPath = `/pots/${potId}/transactions/${txId}`;
  const editHref =
    type === 'contribution'
      ? withReturn(`/pots/${potId}/add-money?editId=${txId}`, txPath)
      : type === 'settlement'
        ? withReturn(`/pots/${potId}/edit-settlement?txId=${txId}`, txPath)
        : withReturn(`/pots/${potId}/add-expense?editId=${txId}`, txPath);

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
