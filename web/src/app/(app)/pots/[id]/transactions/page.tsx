import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  calculateContributionSummaries,
  evaluateContributionExpectation,
  sortContributionSummaries,
  sortTransactionsRecentFirst,
} from '@/lib/core/logic/accounting';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TransactionType } from '@/lib/core/models';

const FILTERS: { key: string; label: string; types?: TransactionType[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'contribution', label: 'Contributions', types: ['contribution'] },
  { key: 'expense', label: 'Expenses', types: ['pool_expense', 'member_expense'] },
  { key: 'settlement', label: 'Settlements', types: ['settlement'] },
  { key: 'summary', label: 'By member' },
];

export const metadata = { title: 'Activity' };

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam } = await searchParams;
  const filter = typeParam ?? 'all';
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const { members, transactions, pot } = bundle;
  const nameOf = (memberId?: string) => members.find((m) => m.id === memberId)?.name ?? '—';

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const filtered =
    filter === 'summary'
      ? []
      : sortTransactionsRecentFirst(
          activeFilter.types
            ? transactions.filter((t) => activeFilter.types!.includes(t.type))
            : transactions,
        );

  const summaries =
    filter === 'summary'
      ? sortContributionSummaries(
          calculateContributionSummaries(members, transactions).filter((s) => {
            const m = members.find((x) => x.id === s.memberId);
            return s.count > 0 || m?.status === 'active';
          }),
          members.map((m) => m.id),
        )
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Activity</h2>
          <p className="mt-1 text-sm text-ink-soft">All contributions, expenses, and settlements.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/pots/${id}/add-money`} size="sm" variant="secondary">
            Add money
          </ButtonLink>
          <ButtonLink href={`/pots/${id}/add-expense`} size="sm">
            Add expense
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? `/pots/${id}/transactions` : `/pots/${id}/transactions?type=${f.key}`}
            className={cn(
              'rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium',
              filter === f.key ? 'bg-accent text-white' : 'text-ink-soft hover:bg-surface-sunk',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {filter === 'summary' ? (
        summaries.length === 0 ? (
          <EmptyState title="No contributions yet" />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-line md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-sunk text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Count</th>
                    <th className="px-4 py-3 font-medium">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const exp = evaluateContributionExpectation(
                      s.total,
                      pot.expectedContributionPerMember ?? null,
                    );
                    return (
                      <tr key={s.memberId} className="border-t border-line">
                        <td className="px-4 py-3">
                          <Link
                            href={`/pots/${id}/contributions/${s.memberId}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {nameOf(s.memberId)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{formatMoney(s.total)}</td>
                        <td className="px-4 py-3">{s.count}</td>
                        <td className="px-4 py-3 capitalize text-ink-soft">
                          {exp.status === 'none' ? '—' : exp.status.replace('_', ' ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-3 md:hidden">
              {summaries.map((s) => (
                <li key={s.memberId}>
                  <Link href={`/pots/${id}/contributions/${s.memberId}`}>
                    <Card className="flex items-center justify-between p-4">
                      <span className="font-medium">{nameOf(s.memberId)}</span>
                      <span>{formatMoney(s.total)}</span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )
      ) : filtered.length === 0 ? (
        <EmptyState title="No transactions" description="Nothing matches this filter yet." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunk text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} className="border-t border-line hover:bg-surface-sunk/40">
                    <td className="px-4 py-3 text-ink-soft">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/pots/${id}/transactions/${tx.id}`} className="font-medium text-accent hover:underline">
                        {tx.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{tx.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">{tx.paidBy ? nameOf(tx.paidBy) : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(tx.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {filtered.map((tx) => (
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
                        <Badge className="mt-1 capitalize">{tx.type.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
