import { notFound } from 'next/navigation';
import { EditSettlementForm } from '@/components/pot/edit-settlement-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canEditTransaction } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Edit settlement' };

export default async function EditSettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ txId?: string }>;
}) {
  const { id } = await params;
  const { txId } = await searchParams;
  if (!txId) notFound();

  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const tx = bundle.transactions.find((t) => t.id === txId && t.type === 'settlement');
  if (!tx) notFound();

  if (!canEditTransaction(bundle.currentMember ?? undefined, tx)) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to edit this settlement."
        action={<ButtonLink href={`/pots/${id}/transactions/${txId}`}>Back</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Edit settlement</h2>
        <p className="mt-1 text-sm text-ink-soft">Update the recorded transfer between members.</p>
      </div>
      <EditSettlementForm potId={id} members={bundle.members} tx={tx} />
    </div>
  );
}
