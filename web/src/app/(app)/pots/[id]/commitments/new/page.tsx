import { notFound } from 'next/navigation';
import { CommitmentForm } from '@/components/pot/commitment-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canCreateCommitment } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'New upcoming payment' };

export default async function NewCommitmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  if (!canCreateCommitment(bundle.currentMember ?? undefined)) {
    return (
      <EmptyState
        title="Not permitted"
        description="You don't have permission to create upcoming payments."
        action={<ButtonLink href={`/pots/${id}/commitments`}>Back</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">New upcoming payment</h2>
        <p className="mt-1 text-sm text-ink-soft">Track a planned cost before it hits the ledger.</p>
      </div>
      <CommitmentForm potId={id} />
    </div>
  );
}
