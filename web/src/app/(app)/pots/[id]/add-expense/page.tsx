import { notFound } from 'next/navigation';
import { AddExpenseForm } from '@/components/pot/add-expense-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canAddExpense, canEditTransaction, canManageCategories } from '@/lib/core/logic/permissions';
import { potReturnLabel, safePotReturn } from '@/lib/navigation/pot-trail';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Add expense' };

export default async function AddExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editId?: string; linkCommitmentId?: string; from?: string }>;
}) {
  const { id } = await params;
  const { editId, linkCommitmentId, from } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const editingTx = editId
    ? bundle.transactions.find(
        (t) => t.id === editId && (t.type === 'pool_expense' || t.type === 'member_expense'),
      )
    : undefined;

  if (editId && !editingTx) notFound();

  const allowed = editingTx
    ? canEditTransaction(bundle.currentMember ?? undefined, editingTx, bundle.poolManagerMemberId)
    : canAddExpense(bundle.currentMember ?? undefined, bundle.poolManagerMemberId);

  const backHref = safePotReturn(
    id,
    from,
    editingTx ? `/pots/${id}/transactions/${editingTx.id}` : `/pots/${id}/transactions`,
  );

  if (!allowed) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to add or edit expenses."
        action={<ButtonLink href={backHref}>← {potReturnLabel(id, backHref)}</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-semibold text-ink">
          {editingTx ? 'Edit expense' : 'Add expense'}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {linkCommitmentId ? 'Record a payment toward a planned payment.' : 'Split a cost across the group.'}
        </p>
      </div>
      <AddExpenseForm
        potId={id}
        members={bundle.members}
        poolAccounts={bundle.poolAccounts}
        categories={bundle.categories}
        canManageCategories={canManageCategories(bundle.currentMember ?? undefined)}
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
