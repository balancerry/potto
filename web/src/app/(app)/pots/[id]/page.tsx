import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  calculateMyPosition,
  calculatePoolBalance,
  calculateTotalContributions,
  calculateTotalSpent,
  sortTransactionsRecentFirst,
} from '@/lib/core/logic/accounting';
import { calculateTotalUpcomingRemaining } from '@/lib/core/logic/commitments';
import { canAddExpense, canAddMoney, canReviewJoinRequests } from '@/lib/core/logic/permissions';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

function positionLabel(kind: ReturnType<typeof calculateMyPosition>['kind'], amount: number): string {
  switch (kind) {
    case 'settled':
      return "You're settled up";
    case 'receive':
      return `You should receive ${formatMoney(amount)}`;
    case 'pool_only':
      return `Add ${formatMoney(amount)} to the pool`;
    case 'member_only':
      return `Pay members ${formatMoney(amount)}`;
    case 'pool_and_member':
      return `Settle ${formatMoney(amount)} (pool + members)`;
    default:
      return formatMoney(amount);
  }
}

export default async function PotDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const { pot, members, transactions, joinRequests, commitments, commitmentPayments, currentMember } = bundle;
  const activeMembers = members.filter((m) => m.status === 'active');
  const poolBalance = calculatePoolBalance(transactions);
  const contributed = calculateTotalContributions(transactions);
  const spent = calculateTotalSpent(transactions);
  const upcomingRemaining = calculateTotalUpcomingRemaining(commitments, commitmentPayments, transactions);
  const myPosition = currentMember
    ? calculateMyPosition(activeMembers, transactions, currentMember.id)
    : null;
  const recent = sortTransactionsRecentFirst(transactions).slice(0, 8);
  const pendingJoins = joinRequests.filter((r) => r.status === 'pending');
  const canWriteMoney = canAddMoney(currentMember ?? undefined);
  const canWriteExpense = canAddExpense(currentMember ?? undefined);
  const showJoinBanner = canReviewJoinRequests(currentMember ?? undefined) && pendingJoins.length > 0;

  const nameOf = (memberId?: string) => members.find((m) => m.id === memberId)?.name ?? '—';

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Pool balance</p>
          <p className="mt-1 font-display text-3xl font-semibold text-accent">{formatMoney(poolBalance)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Contributed</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">{formatMoney(contributed)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Spent</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">{formatMoney(spent)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-soft">Upcoming remaining</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">{formatMoney(upcomingRemaining)}</p>
        </Card>
      </div>

      {myPosition ? (
        <Card className="border-accent/20 bg-accent-soft/40">
          <CardTitle className="text-base">Your position</CardTitle>
          <p className="mt-2 text-lg font-medium text-ink">
            {positionLabel(myPosition.kind, myPosition.amount)}
          </p>
          <div className="mt-3">
            <ButtonLink href={`/pots/${id}/balance`} variant="outline" size="sm">
              See balance breakdown
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      {showJoinBanner ? (
        <Card className="border-gold/30 bg-gold-soft/50">
          <CardTitle className="text-base">
            {pendingJoins.length} pending join request{pendingJoins.length === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>Review new people who want to join this pot.</CardDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingJoins.slice(0, 3).map((r) => (
              <ButtonLink key={r.id} href={`/pots/${id}/join-requests/${r.id}`} variant="secondary" size="sm">
                Review {r.requestedName}
              </ButtonLink>
            ))}
            <ButtonLink href={`/pots/${id}/members`} variant="outline" size="sm">
              All members
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      {(canWriteMoney || canWriteExpense) && pot.status === 'active' ? (
        <div className="flex flex-wrap gap-2">
          {canWriteMoney ? (
            <ButtonLink href={`/pots/${id}/add-money`}>Add money</ButtonLink>
          ) : null}
          {canWriteExpense ? (
            <ButtonLink href={`/pots/${id}/add-expense`} variant="secondary">
              Add expense
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/pots/${id}/settle`} variant="outline">
            Settle up
          </ButtonLink>
          <ButtonLink href={`/pots/${id}/commitments/new`} variant="outline">
            Add upcoming
          </ButtonLink>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink">Recent activity</h2>
          <ButtonLink href={`/pots/${id}/transactions`} variant="ghost" size="sm">
            View all
          </ButtonLink>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No transactions yet" description="Add money or an expense to get started." />
        ) : (
          <>
            <ul className="hidden divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface md:block">
              {recent.map((tx) => (
                <li key={tx.id}>
                  <Link
                    href={`/pots/${id}/transactions/${tx.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-sunk/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{tx.description}</p>
                      <p className="text-xs text-ink-soft">
                        {formatDate(tx.date)} · {tx.type.replace('_', ' ')}
                        {tx.paidBy ? ` · ${nameOf(tx.paidBy)}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium text-ink">{formatMoney(tx.amount)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="grid gap-3 md:hidden">
              {recent.map((tx) => (
                <li key={tx.id}>
                  <Link href={`/pots/${id}/transactions/${tx.id}`}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{tx.description}</p>
                          <p className="mt-1 text-xs text-ink-soft">{formatDate(tx.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatMoney(tx.amount)}</p>
                          <Badge className="mt-1">{tx.type.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
