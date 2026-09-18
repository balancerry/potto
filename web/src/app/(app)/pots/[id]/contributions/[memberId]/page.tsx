import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Contributions' };

export default async function MemberContributionsPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const member = bundle.members.find((m) => m.id === memberId);
  if (!member) notFound();

  const contributions = bundle.transactions
    .filter((t) => t.type === 'contribution' && t.paidBy === memberId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const total = contributions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{member.name}&apos;s contributions</h2>
          <p className="mt-1 text-sm text-ink-soft">Total {formatMoney(total)}</p>
        </div>
        <ButtonLink href={`/pots/${id}/balance?memberId=${memberId}`} variant="outline" size="sm">
          Balance
        </ButtonLink>
      </div>

      {contributions.length === 0 ? (
        <EmptyState title="No contributions" description="This member hasn't added money yet." />
      ) : (
        <ul className="space-y-2">
          {contributions.map((tx) => (
            <li key={tx.id}>
              <Link href={`/pots/${id}/transactions/${tx.id}`}>
                <Card className="flex items-center justify-between p-4 hover:bg-surface-sunk/40">
                  <div>
                    <p className="font-medium text-ink">{formatDate(tx.date)}</p>
                    {tx.note ? <p className="text-xs text-ink-soft">{tx.note}</p> : null}
                  </div>
                  <p className="font-medium">{formatMoney(tx.amount)}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
