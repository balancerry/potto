'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RecordSettlementForm } from '@/components/pot/record-settlement-form';
import { Button, ButtonLink } from '@/components/ui/button';
import { withReturn } from '@/lib/navigation/pot-trail';
import { formatMoney } from '@/lib/core/money';
import type { Member } from '@/lib/core/models';
import type { PoolFundingPlan } from '@/lib/core/logic/accounting';
import type { SettlementTransfer } from '@/types/models';

export function SettleClient({
  potId,
  members,
  plan,
  transfers,
  currentMemberId,
  canSettle,
  canAddMoney,
  canAddExpense,
  hasActivity,
  hasExpenses,
  hasSettlements,
  collected,
  spent,
}: {
  potId: string;
  members: Member[];
  plan: PoolFundingPlan;
  transfers: SettlementTransfer[];
  currentMemberId?: string;
  canSettle: boolean;
  canAddMoney: boolean;
  canAddExpense: boolean;
  hasActivity: boolean;
  hasExpenses: boolean;
  hasSettlements: boolean;
  collected: number;
  spent: number;
}) {
  const [recording, setRecording] = useState<{
    from?: string;
    to?: string;
    amount?: number;
  } | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const active = members.filter((m) => m.status === 'active');
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '—';
  const needed = new Map(plan.contributions.map((c) => [c.memberId, c.amount]));
  const nothingOutstanding = plan.amountNeeded === 0 && transfers.length === 0;
  const quiet = !hasActivity && nothingOutstanding;
  const settled = hasActivity && (hasExpenses || hasSettlements) && nothingOutstanding;
  const fundedOnly = hasActivity && !settled && nothingOutstanding;

  if (quiet) {
    return (
      <div className="max-w-3xl space-y-8">
        <PoolStatus
          amount={plan.poolBalance}
          collected={collected}
          spent={spent}
          settle="—"
          note="No money has been added to this Pot yet."
        />
        <section className="max-w-prose">
          <h3 className="font-display text-xl font-semibold text-ink">Nothing to settle yet</h3>
          <p className="mt-2 text-sm text-ink-soft">Your group hasn&apos;t recorded any money movement yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            Once your group starts adding contributions or expenses, Potto will calculate who needs to add money and
            who should receive it.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canAddMoney ? <ButtonLink href={withReturn(`/pots/${potId}/add-money`, `/pots/${potId}/settle`)}>Add contribution</ButtonLink> : null}
            {canAddExpense ? (
              <ButtonLink href={withReturn(`/pots/${potId}/add-expense`, `/pots/${potId}/settle`)} variant="outline">
                Add expense
              </ButtonLink>
            ) : null}
          </div>
        </section>
        <HowSettlementWorks />
      </div>
    );
  }

  if (fundedOnly) {
    return (
      <div className="max-w-3xl space-y-8">
        <PoolStatus
          amount={plan.poolBalance}
          collected={collected}
          spent={spent}
          settle="—"
          note={plan.poolBalance > 0 ? 'Available in the Pot.' : 'No expenses have been recorded yet.'}
        />
        <section className="max-w-prose">
          <h3 className="font-display text-xl font-semibold text-ink">
            {plan.poolBalance > 0 ? 'Pool is funded' : 'Nothing to settle yet'}
          </h3>
          <p className="mt-2 text-sm text-ink-soft">
            {plan.poolBalance > 0
              ? 'No member settlement is needed yet. The group has money in the Pot, but no expenses have created a settlement requirement.'
              : 'Settlement will appear after group expenses are recorded.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canAddExpense ? <ButtonLink href={withReturn(`/pots/${potId}/add-expense`, `/pots/${potId}/settle`)}>Add expense</ButtonLink> : null}
            <Link href={`/pots/${potId}/transactions`} className="text-sm font-medium text-accent hover:underline">
              View activity
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (settled) {
    return (
      <section className="max-w-xl space-y-4">
        <h3 className="font-display text-xl font-semibold text-ink">✓ All settled</h3>
        <div>
          <p className="text-sm text-ink-soft">Pool balance</p>
          <p className="font-money text-3xl font-bold text-ink">{formatMoney(plan.poolBalance)}</p>
          <p className="mt-2 text-sm text-ink-soft">Everyone is balanced.</p>
        </div>
        <dl className="max-w-xs space-y-2 text-sm">
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
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {plan.amountNeeded > 0 ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">
              {formatMoney(plan.amountNeeded)} still needs to be added to the Pot.
            </h3>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Group funding</h4>
            <ul className="mt-2 divide-y divide-line">
              {active.map((member) => {
                const amount = needed.get(member.id) ?? 0;
                return (
                  <li
                    key={member.id}
                    className={`flex items-center justify-between gap-4 py-3 ${member.id === currentMemberId ? 'rounded-[var(--radius-sm)] bg-accent-soft/50 px-2' : ''}`}
                  >
                    <div>
                      <p className="font-semibold text-ink">{member.name}</p>
                      <p className="text-sm text-ink-soft">
                        {amount > 0 ? `${formatMoney(amount)} to add` : 'No payment needed'}
                      </p>
                    </div>
                    {amount > 0 && member.id === currentMemberId && canAddMoney ? (
                      <ButtonLink href={withReturn(`/pots/${potId}/add-money`, `/pots/${potId}/settle`)} size="sm">
                        Add {formatMoney(amount)}
                      </ButtonLink>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3">
              <ButtonLink href={`/pots/${potId}/balance`} variant="outline" size="sm">
                View details
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">✓ Pool is balanced</h3>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Member settlement</p>
          </div>
          <ul className="divide-y divide-line">
            {transfers.map((t) => (
              <li key={`${t.from}-${t.to}-${t.amount}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">
                    {nameOf(t.from)} → {nameOf(t.to)}
                  </p>
                  <p className="text-sm text-ink-soft">{formatMoney(t.amount)} remaining</p>
                </div>
                {canSettle ? (
                  <Button size="sm" onClick={() => setRecording({ from: t.from, to: t.to, amount: t.amount })}>
                    Mark as paid
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {transfers.length === 1 ? (
            <p className="text-sm text-ink-soft">1 payment remaining</p>
          ) : (
            <p className="text-sm text-ink-soft">{transfers.length} payments remaining</p>
          )}
        </section>
      )}

      {recording ? (
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => setRecording(null)}>
            Clear form
          </Button>
          <RecordSettlementForm
            potId={potId}
            members={members}
            defaultFrom={recording.from}
            defaultTo={recording.to}
            defaultAmountPaise={recording.amount}
            onDone={() => setRecording(null)}
          />
        </div>
      ) : null}

      {canSettle && !recording ? (
        <section>
          <button
            type="button"
            className="text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-expanded={advanced}
            onClick={() => setAdvanced((open) => !open)}
          >
            Advanced settlement options
          </button>
          {advanced ? (
            <div className="mt-3">
              <Button variant="outline" onClick={() => setRecording({})}>
                Record a custom settlement
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function PoolStatus({
  amount,
  collected,
  spent,
  settle,
  note,
}: {
  amount: number;
  collected: number;
  spent: number;
  settle: string;
  note: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Pool status</h3>
        <p className="mt-1 font-money text-4xl font-bold text-accent">{formatMoney(amount)}</p>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">{note}</p>
      </div>
      <ol className="grid grid-cols-3 gap-2 border-y border-line py-4 text-center">
        <li>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Collected</p>
          <p className="mt-1 font-money text-lg font-semibold text-ink">{formatMoney(collected)}</p>
        </li>
        <li className="border-x border-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Spent</p>
          <p className="mt-1 font-money text-lg font-semibold text-ink">{formatMoney(spent)}</p>
        </li>
        <li>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Settle</p>
          <p className="mt-1 font-money text-lg font-semibold text-ink">{settle}</p>
        </li>
      </ol>
      <p className="text-center text-xs text-ink-soft">Collect → Spend → Settle</p>
    </section>
  );
}

function HowSettlementWorks() {
  const steps = [
    { n: '01', title: 'Collect', body: 'Everyone adds their share to the Pot.' },
    { n: '02', title: 'Spend', body: "Record the group's expenses." },
    { n: '03', title: 'Settle', body: 'Potto shows the remaining payments between members.' },
  ];
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">How settlement works</h3>
      <ol className="mt-3 grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <li key={step.n}>
            <p className="font-sans text-lg font-semibold text-accent">{step.n}</p>
            <p className="mt-1 font-medium text-ink">{step.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
