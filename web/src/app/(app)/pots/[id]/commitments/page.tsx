import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  deriveCommitmentStatus,
  deriveDueDateState,
} from '@/lib/core/logic/commitments';
import { canCreateCommitment } from '@/lib/core/logic/permissions';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata = { title: 'Upcoming payments' };

export default async function CommitmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const items = bundle.commitments.map((c) => {
    const paid = calculateCommitmentPaid(c.id, bundle.commitmentPayments, bundle.transactions);
    const remaining = calculateCommitmentRemaining(c, bundle.commitmentPayments, bundle.transactions);
    const status = deriveCommitmentStatus(c, paid);
    const due = deriveDueDateState(c, status);
    return { c, paid, remaining, status, due };
  });

  const open = items.filter((i) => i.status !== 'cancelled' && i.status !== 'fully_paid');
  const done = items.filter((i) => i.status === 'fully_paid' || i.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Upcoming payments</h2>
          <p className="mt-1 text-sm text-ink-soft">Planned obligations — they don&apos;t affect the pool until paid.</p>
        </div>
        {canCreateCommitment(bundle.currentMember ?? undefined) ? (
          <ButtonLink href={`/pots/${id}/commitments/new`}>Add upcoming</ButtonLink>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No upcoming payments"
          description="Track hotel deposits, tickets, and other planned costs."
          action={
            canCreateCommitment(bundle.currentMember ?? undefined) ? (
              <ButtonLink href={`/pots/${id}/commitments/new`}>Create one</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="font-display text-lg font-semibold">Open</h3>
            {open.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing outstanding.</p>
            ) : (
              <ul className="grid gap-3">
                {open.map(({ c, paid, remaining, status, due }) => (
                  <li key={c.id}>
                    <Link href={`/pots/${id}/commitments/${c.id}`}>
                      <Card className="p-4 hover:bg-surface-sunk/40">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{c.title}</p>
                            <p className="mt-1 text-xs text-ink-soft">
                              {c.dueDate ? `Due ${formatDate(c.dueDate)}` : 'No due date'} · {due.replace('_', ' ')}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge tone="accent" className="capitalize">
                                {status.replace('_', ' ')}
                              </Badge>
                              {c.category ? <Badge>{c.category}</Badge> : null}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatMoney(remaining)} left</p>
                            <p className="text-xs text-ink-soft">
                              {formatMoney(paid)} / {formatMoney(c.totalAmount)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 ? (
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-ink-soft">Closed</h3>
              <ul className="space-y-2 text-sm">
                {done.map(({ c, status }) => (
                  <li key={c.id}>
                    <Link
                      href={`/pots/${id}/commitments/${c.id}`}
                      className="flex justify-between gap-2 rounded-[var(--radius-md)] bg-surface-sunk px-3 py-2 hover:bg-line/40"
                    >
                      <span>{c.title}</span>
                      <span className="capitalize text-ink-soft">{status.replace('_', ' ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
