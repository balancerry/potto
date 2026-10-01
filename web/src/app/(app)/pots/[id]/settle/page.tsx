import { notFound } from 'next/navigation';
import { SettleClient } from '@/components/pot/settle-client';
import {
  calculateMemberSettlementTransfers,
  calculatePoolFundingPlan,
  calculateTotalContributions,
  calculateTotalSpent,
} from '@/lib/core/logic/accounting';
import { canAddExpense, canAddMoney, canSettle } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Settle' };

export default async function SettlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const active = bundle.members.filter((m) => m.status === 'active');
  const plan = calculatePoolFundingPlan(active, bundle.transactions);
  const transfers = calculateMemberSettlementTransfers(active, bundle.transactions);
  const viewer = bundle.currentMember ?? undefined;
  const allowed = canSettle(viewer);
  const hasActivity = bundle.transactions.length > 0;
  const hasExpenses = bundle.transactions.some((tx) => tx.type === 'pool_expense' || tx.type === 'member_expense');
  const hasSettlements = bundle.transactions.some((tx) => tx.type === 'settlement');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Settle up</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Balance the Pot and settle any remaining member payments.
        </p>
      </div>
      <SettleClient
        potId={id}
        members={bundle.members}
        plan={plan}
        transfers={transfers}
        currentMemberId={bundle.currentMember?.id}
        canSettle={allowed}
        canAddMoney={canAddMoney(viewer, bundle.poolManagerMemberId) && bundle.pot.status === 'active'}
        canAddExpense={canAddExpense(viewer, bundle.poolManagerMemberId) && bundle.pot.status === 'active'}
        hasActivity={hasActivity}
        hasExpenses={hasExpenses}
        hasSettlements={hasSettlements}
        collected={calculateTotalContributions(bundle.transactions)}
        spent={calculateTotalSpent(bundle.transactions)}
      />
    </div>
  );
}
