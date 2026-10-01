import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sortTransactionsRecentFirst } from '@/lib/core/logic/accounting';
import {
  CATEGORY_FILTER_ALL,
  categoryFilterOptions,
  matchesCategoryFilter,
  resolveCategory,
} from '@/lib/core/logic/categories';
import { activityDetail } from '@/lib/core/logic/pool-money';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { CategoryBadge } from '@/components/categories/category-icon';
import { ActivityFilters } from '@/components/pot/activity-filters';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { Transaction, TransactionType } from '@/lib/core/models';
import { activityListPath, withReturn } from '@/lib/navigation/pot-trail';

const TYPE_FILTERS: Record<string, TransactionType[] | undefined> = {
  all: undefined,
  contribution: ['contribution'],
  expense: ['pool_expense', 'member_expense'],
  settlement: ['settlement'],
  transfer: ['pool_transfer'],
};

function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function inDateRange(iso: string, range: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  if (range === 'today') return day === localDay();
  if (range === 'week') {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return day >= localDay(start) && day <= localDay();
  }
  if (range === 'month') return day.slice(0, 7) === localDay().slice(0, 7);
  if (range === 'custom') {
    if (from && day < from) return false;
    if (to && day > to) return false;
  }
  return true;
}

function involvesMember(tx: Transaction, memberId: string): boolean {
  if (tx.paidBy === memberId || tx.toMember === memberId || tx.createdBy === memberId) return true;
  return (tx.splits ?? []).some((split) => split.memberId === memberId);
}

const TYPE_LABEL: Record<TransactionType, string> = {
  contribution: 'Contribution',
  pool_expense: 'Expense',
  member_expense: 'Expense',
  settlement: 'Settlement',
  pool_transfer: 'Transfer',
};

export const metadata = { title: 'Activity' };

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; member?: string; category?: string; range?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam, member: memberParam, category: categoryParam, range: rangeParam, from, to } = await searchParams;
  const filter = TYPE_FILTERS[typeParam ?? 'all'] ? (typeParam ?? 'all') : 'all';
  const member = memberParam ?? 'all';
  const category = categoryParam ?? CATEGORY_FILTER_ALL;
  const range = rangeParam ?? 'all';
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const { members, transactions, categories } = bundle;
  const categoryOptions = categoryFilterOptions(categories, transactions);
  const categoryOf = (tx: Transaction) =>
    tx.type === 'pool_expense' || tx.type === 'member_expense' ? resolveCategory(tx.categoryId, categories) : null;
  const nameOf = (memberId?: string) => members.find((m) => m.id === memberId)?.name ?? '—';
  const types = TYPE_FILTERS[filter];
  const filtered = sortTransactionsRecentFirst(transactions).filter((tx) => {
    if (types && !types.includes(tx.type)) return false;
    if (member !== 'all' && !involvesMember(tx, member)) return false;
    if (!matchesCategoryFilter(tx, category)) return false;
    if (!inDateRange(tx.date, range, from, to)) return false;
    return true;
  });
  const here = activityListPath(id, { type: filter, member, category, range, from, to });
  const filtersActive = filter !== 'all' || member !== 'all' || category !== CATEGORY_FILTER_ALL || range !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Activity</h2>
          <p className="mt-1 text-sm text-ink-soft">All contributions, expenses, settlements and transfers.</p>
        </div>
        {transactions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={withReturn(`/pots/${id}/add-money`, here)} size="sm" variant="secondary">
              Add contribution
            </ButtonLink>
            <ButtonLink href={withReturn(`/pots/${id}/add-expense`, here)} size="sm" variant="outline">
              Add expense
            </ButtonLink>
          </div>
        ) : null}
      </div>

      <ActivityFilters
        potId={id}
        type={filter}
        member={member}
        category={category}
        range={range}
        from={from}
        to={to}
        members={members}
        categoryOptions={categoryOptions}
      />

      {filtered.length === 0 ? (
        <EmptyState
          className="py-8"
          title={filtersActive ? 'Nothing matches these filters' : 'No activity yet'}
          description={
            filtersActive
              ? 'Try a different activity type, member, category, or date.'
              : 'Add the first contribution or expense to start tracking this Pot.'
          }
          action={
            filtersActive ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href={withReturn(`/pots/${id}/add-money`, here)}>Add contribution</ButtonLink>
                <ButtonLink href={withReturn(`/pots/${id}/add-expense`, here)} variant="outline">
                  Add expense
                </ButtonLink>
              </div>
            )
          }
        />
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
                      <Link href={withReturn(`/pots/${id}/transactions/${tx.id}`, here)} className="font-medium text-accent hover:underline">
                        {tx.description}
                      </Link>
                      {categoryOf(tx) ? <CategoryBadge category={categoryOf(tx)!} className="mt-0.5 flex" /> : null}
                    </td>
                    <td className="px-4 py-3">{TYPE_LABEL[tx.type]}</td>
                    <td className="px-4 py-3">
                      {activityDetail(tx, nameOf, (accountId) => bundle.poolAccounts.find((a) => a.id === accountId)?.name ?? 'Pool')}
                    </td>
                    <td className="px-4 py-3 text-right font-money font-semibold">{formatMoney(tx.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden">
            {filtered.map((tx) => (
              <li key={tx.id}>
                <Link href={withReturn(`/pots/${id}/transactions/${tx.id}`, here)}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{tx.description}</p>
                        <p className="mt-1 text-xs text-ink-soft">{formatDate(tx.date)}</p>
                        {categoryOf(tx) ? <CategoryBadge category={categoryOf(tx)!} className="mt-1 flex" /> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-money font-semibold">{formatMoney(tx.amount)}</p>
                        <Badge className="mt-1">{TYPE_LABEL[tx.type]}</Badge>
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
