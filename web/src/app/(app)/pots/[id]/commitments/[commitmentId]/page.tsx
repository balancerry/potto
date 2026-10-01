import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommitmentActions } from '@/components/pot/commitment-actions';
import { CommitmentForm } from '@/components/pot/commitment-form';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  deriveCommitmentStatus,
} from '@/lib/core/logic/commitments';
import {
  canAddCommitmentPayment,
  canCancelCommitment,
  canEditCommitment,
  canManageCategories,
} from '@/lib/core/logic/permissions';
import { resolveCategory } from '@/lib/core/logic/categories';
import { formatDateFull, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { CategoryBadge } from '@/components/categories/category-icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { withReturn } from '@/lib/navigation/pot-trail';

export const metadata = { title: 'Planned payment' };

export default async function CommitmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; commitmentId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id, commitmentId } = await params;
  const { edit } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const commitment = bundle.commitments.find((c) => c.id === commitmentId);
  if (!commitment) notFound();

  const me = bundle.currentMember ?? undefined;
  const paid = calculateCommitmentPaid(commitmentId, bundle.commitmentPayments, bundle.transactions);
  const remaining = calculateCommitmentRemaining(commitment, bundle.commitmentPayments, bundle.transactions);
  const status = deriveCommitmentStatus(commitment, paid);
  const cancelled = status === 'cancelled' || commitment.status === 'cancelled';

  if (edit === '1' && canEditCommitment(me, commitment) && !cancelled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-sans text-2xl font-semibold text-ink">Edit planned payment</h2>
        </div>
        <CommitmentForm
          potId={id}
          editing={commitment}
          categories={bundle.categories}
          canManageCategories={canManageCategories(me)}
        />
      </div>
    );
  }

  const linkedPayments = bundle.commitmentPayments.filter((p) => p.commitmentId === commitmentId);
  const nameOf = (memberId?: string) => bundle.members.find((m) => m.id === memberId)?.name ?? '—';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-semibold text-ink">{commitment.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="accent" className="capitalize">
            {status.replace('_', ' ')}
          </Badge>
          {commitment.categoryId ? (
            <CategoryBadge category={resolveCategory(commitment.categoryId, bundle.categories)} className="self-center" />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={formatMoney(commitment.totalAmount)} />
        <Stat label="Paid" value={formatMoney(paid)} />
        <Stat label="Left" value={formatMoney(remaining)} />
      </div>

      <Card className="space-y-3 text-sm">
        {commitment.vendorName ? <Row label="Vendor" value={commitment.vendorName} /> : null}
        {commitment.dueDate ? <Row label="Due" value={formatDateFull(commitment.dueDate)} /> : null}
        {commitment.description ? <Row label="Notes" value={commitment.description} /> : null}
      </Card>

      <CommitmentActions
        potId={id}
        commitmentId={commitmentId}
        canEdit={canEditCommitment(me, commitment)}
        canCancel={canCancelCommitment(me)}
        canPay={canAddCommitmentPayment(me)}
        cancelled={cancelled}
      />

      <section className="space-y-3">
        <CardTitle className="text-base">Linked payments</CardTitle>
        {linkedPayments.length === 0 ? (
          <p className="text-sm text-ink-soft">No payments linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {linkedPayments.map((p) => {
              const tx = bundle.transactions.find((t) => t.id === p.transactionId);
              return (
                <li key={p.id}>
                  <Link href={withReturn(`/pots/${id}/transactions/${p.transactionId}`, `/pots/${id}/commitments/${commitmentId}`)}>
                    <Card className="flex justify-between gap-3 p-3 text-sm hover:bg-surface-sunk/40">
                      <div>
                        <p className="font-medium">{tx?.description ?? 'Payment'}</p>
                        <p className="text-xs text-ink-soft">
                          {tx ? formatDateFull(tx.date) : ''}
                          {tx?.paidBy ? ` · ${nameOf(tx.paidBy)}` : ''}
                        </p>
                      </div>
                      <p className="font-money font-semibold">{formatMoney(p.amount)}</p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-sunk p-3 text-center">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 font-money text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
