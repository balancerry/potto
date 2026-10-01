import { notFound } from 'next/navigation';
import { AddMoneyForm } from '@/components/pot/add-money-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { calculatePoolBalance } from '@/lib/core/logic/accounting';
import { canAddMoney, canEditTransaction } from '@/lib/core/logic/permissions';
import { potReturnLabel, safePotReturn } from '@/lib/navigation/pot-trail';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Add money to the Pot' };

export default async function AddMoneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editId?: string; from?: string }>;
}) {
  const { id } = await params;
  const { editId, from } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const editingTx = editId
    ? bundle.transactions.find((t) => t.id === editId && t.type === 'contribution')
    : undefined;

  if (editId && !editingTx) notFound();

  const allowed = editingTx
    ? canEditTransaction(bundle.currentMember ?? undefined, editingTx, bundle.poolManagerMemberId)
    : canAddMoney(bundle.currentMember ?? undefined, bundle.poolManagerMemberId);

  const backHref = safePotReturn(id, from, editingTx ? `/pots/${id}/transactions/${editingTx.id}` : `/pots/${id}/transactions`);

  if (!allowed) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to add or edit contributions."
        action={<ButtonLink href={backHref}>← {potReturnLabel(id, backHref)}</ButtonLink>}
      />
    );
  }

  return (
    <AddMoneyForm
      potId={id}
      members={bundle.members}
      poolAccounts={bundle.poolAccounts}
      defaultMemberId={bundle.currentMember?.id}
      editingTx={editingTx}
      poolBalance={calculatePoolBalance(bundle.transactions)}
    />
  );
}
