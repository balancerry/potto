import Link from 'next/link';
import { notFound } from 'next/navigation';
import { calculatePoolBalance, calculateTotalContributions, calculateTotalSpent, sortTransactionsRecentFirst } from '@/lib/core/logic/accounting';
import { activityDetail, calculateAccountBalance } from '@/lib/core/logic/pool-money';
import { canAddExpense, canAddMoney, canEditPot, canManagePoolMoney } from '@/lib/core/logic/permissions';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { PoolManagerSettings } from '@/components/pot/pool-manager-settings';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { withReturn } from '@/lib/navigation/pot-trail';

export const metadata = { title: 'Pool management' };

export default async function PoolMoneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const { transactions, poolAccounts, members, poolManagerMemberId, currentMember, pot } = bundle;
  const active = poolAccounts.filter((a) => a.active);
  const total = calculatePoolBalance(transactions);
  const collected = calculateTotalContributions(transactions);
  const spent = calculateTotalSpent(transactions);
  const canTransfer = canManagePoolMoney(currentMember ?? undefined, poolManagerMemberId) && pot.status === 'active';
  const canMoney = canAddMoney(currentMember ?? undefined, poolManagerMemberId) && pot.status === 'active';
  const canExpense = canAddExpense(currentMember ?? undefined, poolManagerMemberId) && pot.status === 'active';
  const nameOf = (memberId?: string) => members.find((m) => m.id === memberId)?.name ?? '—';
  const accountName = (accountId?: string) => poolAccounts.find((a) => a.id === accountId)?.name ?? 'Pool';
  const movement = sortTransactionsRecentFirst(transactions)
    .filter((t) => t.type === 'contribution' || t.type === 'pool_expense' || t.type === 'pool_transfer')
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Pool management</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Track the group&apos;s money across bank and cash. Potto does not hold or represent anyone&apos;s personal bank account.
        </p>
      </div>
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Available in the Pot</p>
        <p className="mt-1 font-money text-4xl font-bold text-accent">{formatMoney(total)}</p>
        <dl className="mt-4 max-w-sm space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Collected</dt>
            <dd className="font-medium text-ink">{formatMoney(collected)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Spent</dt>
            <dd className="font-medium text-ink">{formatMoney(spent)}</dd>
          </div>
        </dl>
      </section>
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Money locations</h3>
        {active.length === 0 ? (
          <p className="text-sm text-ink-soft">Pool Bank and Pool Cash have not been set up for this Pot yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((account) => (
              <Card key={account.id} className="p-4">
                <p className="text-sm text-ink-soft">{account.name}</p>
                <p className="mt-1 font-money text-2xl font-bold text-ink">
                  {formatMoney(calculateAccountBalance(transactions, account.id))}
                </p>
              </Card>
            ))}
          </div>
        )}
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-soft">The Pot has no money yet. Add a contribution when the group starts collecting.</p>
        ) : null}
      </section>
      {canMoney || canExpense ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Primary actions</h3>
          <div className="flex flex-wrap gap-2">
            {canMoney ? <ButtonLink href={withReturn(`/pots/${id}/add-money`, `/pots/${id}/pool`)}>Add contribution</ButtonLink> : null}
            {canExpense ? <ButtonLink href={withReturn(`/pots/${id}/add-expense`, `/pots/${id}/pool`)} variant="outline">Add expense</ButtonLink> : null}
          </div>
        </section>
      ) : null}
      <section className="flex flex-wrap gap-4 text-sm">
        {canTransfer ? (
          <Link href={`/pots/${id}/pool/transfer`} className="font-medium text-accent hover:underline">
            Transfer money
          </Link>
        ) : null}
        <Link href={`/pots/${id}/pool/reconcile`} className="font-medium text-ink-soft hover:text-ink hover:underline">
          Reconcile
        </Link>
      </section>
      <PoolManagerSettings
        potId={id}
        members={members}
        poolManagerMemberId={poolManagerMemberId}
        canChange={canEditPot(currentMember ?? undefined) && pot.status === 'active'}
      />
      <section className="space-y-2">
        <h3 className="font-sans text-lg font-semibold">Recent pool movement</h3>
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {movement.length === 0 ? (
            <li className="px-4 py-6 text-sm text-ink-soft">No pool movement yet.</li>
          ) : (
            movement.map((tx) => (
              <li key={tx.id}>
                <Link href={withReturn(`/pots/${id}/transactions/${tx.id}`, `/pots/${id}/pool`)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-sunk/60">
                  <div>
                    <p className="font-medium text-ink">{tx.type === 'pool_transfer' ? 'Transfer' : tx.description}</p>
                    <p className="text-xs text-ink-soft">{formatDate(tx.date)} · {activityDetail(tx, nameOf, accountName)}</p>
                  </div>
                  <p className="font-medium">{formatMoney(tx.amount)}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
