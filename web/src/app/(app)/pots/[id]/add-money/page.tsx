import { notFound } from 'next/navigation';
import { AddMoneyForm } from '@/components/pot/add-money-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canAddMoney, canEditTransaction } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Add money' };

export default async function AddMoneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editId?: string }>;
}) {
  const { id } = await params;
  const { editId } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const editingTx = editId
    ? bundle.transactions.find((t) => t.id === editId && t.type === 'contribution')
    : undefined;

  if (editId && !editingTx) notFound();

  const allowed = editingTx
    ? canEditTransaction(bundle.currentMember ?? undefined, editingTx)
    : canAddMoney(bundle.currentMember ?? undefined);

  if (!allowed) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to add or edit contributions."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">
          {editingTx ? 'Edit contribution' : 'Add money'}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">Record contributions into the shared pool.</p>
      </div>
      <AddMoneyForm
        potId={id}
        members={bundle.members}
        defaultMemberId={bundle.currentMember?.id}
        editingTx={editingTx}
      />
    </div>
  );
}
