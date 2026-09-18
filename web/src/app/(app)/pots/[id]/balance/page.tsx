import { notFound } from 'next/navigation';
import { explainBalance } from '@/lib/core/logic/accounting';
import { formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import { Card, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Balance' };

export default async function BalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { id } = await params;
  const { memberId: memberIdParam } = await searchParams;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const memberId = memberIdParam ?? bundle.currentMember?.id;
  if (!memberId) notFound();

  const member = bundle.members.find((m) => m.id === memberId);
  if (!member) notFound();

  const expl = explainBalance(bundle.transactions, memberId);
  const isMe = memberId === bundle.currentMember?.id;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">
          {isMe ? 'Your balance' : `${member.name}'s balance`}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          How this position is derived from the ledger.
        </p>
      </div>

      <Card className="text-center">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Net position</p>
        <p className={`mt-2 font-display text-4xl font-semibold ${expl.net >= 0 ? 'text-pos' : 'text-neg'}`}>
          {formatMoney(expl.net, { showSign: true })}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {expl.net > 0 ? 'Should receive' : expl.net < 0 ? 'Should pay' : 'Settled'}
        </p>
      </Card>

      <Card className="space-y-3 text-sm">
        <CardTitle className="text-base">Breakdown</CardTitle>
        <Row label="Contributed to pool" value={formatMoney(expl.contributed)} />
        <Row label="Share of expenses" value={formatMoney(-expl.expenseShare)} />
        <Row label="Paid for group (personal)" value={formatMoney(expl.paidForGroup, { showSign: true })} />
        <Row label="Settlements sent" value={formatMoney(expl.settlementsSent, { showSign: true })} />
        <Row label="Settlements received" value={formatMoney(-expl.settlementsReceived)} />
      </Card>

      <p className="text-sm text-ink-soft">
        Net = contributed − expense share + paid for group + settlements sent − settlements received.
      </p>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/pots/${id}/contributions/${memberId}`} variant="outline" size="sm">
          Contributions
        </ButtonLink>
        <ButtonLink href={`/pots/${id}/settle`} variant="outline" size="sm">
          Settle up
        </ButtonLink>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 pb-2 last:border-0 last:pb-0">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
