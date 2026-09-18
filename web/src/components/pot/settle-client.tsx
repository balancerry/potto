'use client';

import { useState } from 'react';
import { RecordSettlementForm } from '@/components/pot/record-settlement-form';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/core/money';
import type { Member } from '@/lib/core/models';
import type { MyPosition, PoolFundingPlan } from '@/lib/core/logic/accounting';
import type { SettlementTransfer } from '@/types/models';

export function SettleClient({
  potId,
  members,
  plan,
  transfers,
  myPosition,
  currentMemberId,
  canSettle,
}: {
  potId: string;
  members: Member[];
  plan: PoolFundingPlan;
  transfers: SettlementTransfer[];
  myPosition: MyPosition | null;
  currentMemberId?: string;
  canSettle: boolean;
}) {
  const [recording, setRecording] = useState<{
    from?: string;
    to?: string;
    amount?: number;
  } | null>(null);

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      {myPosition && currentMemberId ? (
        <Card className="border-accent/20 bg-accent-soft/40">
          <CardTitle className="text-base">Your next step</CardTitle>
          <CardDescription className="mt-2 text-base text-ink">
            {myPosition.kind === 'settled'
              ? "You're settled up."
              : myPosition.kind === 'receive'
                ? `You should receive ${formatMoney(myPosition.amount)}.`
                : `You still need to settle ${formatMoney(myPosition.amount)}.`}
          </CardDescription>
          {myPosition.poolAmount > 0 ? (
            <div className="mt-3">
              <ButtonLink
                href={`/pots/${potId}/add-money`}
                size="sm"
              >
                Add {formatMoney(myPosition.poolAmount)} to pool
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink">1. Pool funding</h3>
        {plan.amountNeeded === 0 ? (
          <p className="text-sm text-ink-soft">Pool is funded. No contributions needed.</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              Need {formatMoney(plan.amountNeeded)} more in the pool
              {plan.target > 0 ? ` (target ${formatMoney(plan.target)})` : ''}.
            </p>
            <ul className="space-y-2">
              {plan.contributions.map((c) => (
                <li key={c.memberId}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-medium">{nameOf(c.memberId)}</p>
                      <p className="text-sm text-ink-soft">Add {formatMoney(c.amount)}</p>
                    </div>
                    <ButtonLink
                      href={`/pots/${potId}/add-money`}
                      size="sm"
                      variant="outline"
                    >
                      Add money
                    </ButtonLink>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink">2. Member transfers</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-ink-soft">No member-to-member transfers outstanding.</p>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t) => (
              <li key={`${t.from}-${t.to}-${t.amount}`}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-ink">
                      {nameOf(t.from)} → {nameOf(t.to)}
                    </p>
                    <p className="text-sm text-ink-soft">{formatMoney(t.amount)}</p>
                  </div>
                  {canSettle ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setRecording({ from: t.from, to: t.to, amount: t.amount })
                      }
                    >
                      Record
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canSettle ? (
        recording ? (
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
        ) : (
          <Button variant="outline" onClick={() => setRecording({})}>
            Record a custom settlement
          </Button>
        )
      ) : null}
    </div>
  );
}
