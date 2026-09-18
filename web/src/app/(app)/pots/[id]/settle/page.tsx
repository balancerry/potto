import { notFound } from 'next/navigation';
import { SettleClient } from '@/components/pot/settle-client';
import {
  calculateMemberSettlementTransfers,
  calculateMyPosition,
  calculatePoolFundingPlan,
} from '@/lib/core/logic/accounting';
import { canSettle } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Settle' };

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const active = bundle.members.filter((m) => m.status === 'active');
  const plan = calculatePoolFundingPlan(active, bundle.transactions);
  const transfers = calculateMemberSettlementTransfers(active, bundle.transactions);
  const myPosition = bundle.currentMember
    ? calculateMyPosition(active, bundle.transactions, bundle.currentMember.id)
    : null;
  const allowed = canSettle(bundle.currentMember ?? undefined);

  if (!allowed && plan.amountNeeded === 0 && transfers.length === 0) {
    return (
      <EmptyState
        title="All settled"
        description="Nothing outstanding right now."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Settle up</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Fund the pool first, then settle remaining member balances.
        </p>
      </div>
      <SettleClient
        potId={id}
        members={bundle.members}
        plan={plan}
        transfers={transfers}
        myPosition={myPosition}
        currentMemberId={bundle.currentMember?.id}
        canSettle={allowed}
      />
    </div>
  );
}
