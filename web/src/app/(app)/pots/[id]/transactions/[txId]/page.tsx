import { notFound } from 'next/navigation';
import { TransactionActions } from '@/components/pot/transaction-actions';
import { canDeleteTransaction, canEditTransaction } from '@/lib/core/logic/permissions';
import { paymentMethodLabel } from '@/lib/core/constants/payment-methods';
import { formatDateFull, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Transaction' };

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string; txId: string }>;
}) {
  const { id, txId } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const tx = bundle.transactions.find((t) => t.id === txId);
  if (!tx) notFound();

  const nameOf = (memberId?: string) => bundle.members.find((m) => m.id === memberId)?.name ?? '—';
  const me = bundle.currentMember ?? undefined;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ButtonLink href={`/pots/${id}/transactions`} variant="ghost" size="sm" className="mb-2 -ml-2">
            ← Activity
          </ButtonLink>
          <h2 className="font-display text-2xl font-semibold text-ink">{tx.description}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="capitalize">{tx.type.replace('_', ' ')}</Badge>
            {tx.category ? <Badge tone="accent">{tx.category}</Badge> : null}
          </div>
        </div>
        <p className="font-display text-3xl font-semibold text-accent">{formatMoney(tx.amount)}</p>
      </div>

      <Card className="space-y-3 text-sm">
        <Row label="Date" value={formatDateFull(tx.date)} />
        {tx.paidBy ? <Row label="From / paid by" value={nameOf(tx.paidBy)} /> : null}
        {tx.toMember ? <Row label="To" value={nameOf(tx.toMember)} /> : null}
        {tx.paymentSource ? <Row label="Source" value={tx.paymentSource} /> : null}
        {tx.paymentMethod ? <Row label="Method" value={paymentMethodLabel(tx.paymentMethod)} /> : null}
        {tx.splitMethod ? <Row label="Split" value={tx.splitMethod} /> : null}
        {tx.note ? <Row label="Note" value={tx.note} /> : null}
      </Card>

      {tx.splits && tx.splits.length > 0 ? (
        <Card>
          <CardTitle className="text-base">Splits</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {tx.splits.map((s) => (
              <li key={s.memberId} className="flex justify-between gap-2">
                <span>{nameOf(s.memberId)}</span>
                <span>{formatMoney(s.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <TransactionActions
        potId={id}
        txId={txId}
        type={tx.type}
        canEdit={canEditTransaction(me, tx)}
        canDelete={canDeleteTransaction(me, tx)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right font-medium capitalize text-ink">{value}</span>
    </div>
  );
}
