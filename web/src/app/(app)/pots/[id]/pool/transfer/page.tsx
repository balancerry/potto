import { notFound } from 'next/navigation';
import { TransferForm } from '@/components/pot/transfer-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canManagePoolMoney } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Transfer pool money' };

export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();
  if (!canManagePoolMoney(bundle.currentMember ?? undefined, bundle.poolManagerMemberId)) {
    return (
      <EmptyState
        title="Not permitted"
        description="Only the pool manager or a pot admin can transfer pool money."
        action={<ButtonLink href={`/pots/${id}/pool`}>← Pool management</ButtonLink>}
      />
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-semibold text-ink">Transfer pool money</h2>
        <p className="mt-1 text-sm text-ink-soft">Move pot money between Pool Bank and Pool Cash. The total stays the same.</p>
      </div>
      <TransferForm potId={id} accounts={bundle.poolAccounts} transactions={bundle.transactions} />
    </div>
  );
}
