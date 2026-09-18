'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cancelCommitment } from '@/lib/actions/commitments';
import { Button, ButtonLink } from '@/components/ui/button';

export function CommitmentActions({
  potId,
  commitmentId,
  canEdit,
  canCancel,
  canPay,
  cancelled,
}: {
  potId: string;
  commitmentId: string;
  canEdit: boolean;
  canCancel: boolean;
  canPay: boolean;
  cancelled: boolean;
}) {
  const router = useRouter();

  async function onCancel() {
    if (!confirm('Cancel this upcoming payment? Linked expenses stay in the ledger.')) return;
    const result = await cancelCommitment(potId, commitmentId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Cancelled');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canPay && !cancelled ? (
        <ButtonLink href={`/pots/${potId}/add-expense?linkCommitmentId=${commitmentId}`}>
          Add payment
        </ButtonLink>
      ) : null}
      {canEdit && !cancelled ? (
        <ButtonLink
          href={`/pots/${potId}/commitments/${commitmentId}?edit=1`}
          variant="outline"
        >
          Edit
        </ButtonLink>
      ) : null}
      {canCancel && !cancelled ? (
        <Button variant="danger" onClick={() => void onCancel()}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
