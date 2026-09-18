import { notFound } from 'next/navigation';
import { AddExpenseForm } from '@/components/pot/add-expense-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canAddExpense, canEditTransaction } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Add expense' };

export default async function AddExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editId?: string; linkCommitmentId?: string }>;
}) {
  const { id } = await params;
  const { editId, linkCommitmentId } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const editingTx = editId
    ? bundle.transactions.find(
        (t) => t.id === editId && (t.type === 'pool_expense' || t.type === 'member_expense'),
      )
    : undefined;

  if (editId && !editingTx) notFound();

  const allowed = editingTx
    ? canEditTransaction(bundle.currentMember ?? undefined, editingTx)
    : canAddExpense(bundle.currentMember ?? undefined);

  if (!allowed) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to add or edit expenses."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">
          {editingTx ? 'Edit expense' : 'Add expense'}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {linkCommitmentId ? 'Record a payment toward an upcoming obligation.' : 'Split a cost across the group.'}
        </p>
      </div>
      <AddExpenseForm
        potId={id}
        members={bundle.members}
        defaultMemberId={bundle.currentMember?.id}
        editingTx={editingTx}
        commitments={bundle.commitments}
        commitmentPayments={bundle.commitmentPayments}
        transactions={bundle.transactions}
        linkCommitmentId={linkCommitmentId}
      />
    </div>
  );
}
