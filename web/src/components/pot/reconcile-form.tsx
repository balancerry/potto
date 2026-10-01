'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatMoney, toPaise, toRupees } from '@/lib/core/money';
import { calculateAccountBalance } from '@/lib/core/logic/pool-money';
import type { PoolAccount, Transaction } from '@/lib/core/models';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ButtonLink } from '@/components/ui/button';
import { CancelLink, useWarnUnsaved } from '@/components/navigation/unsaved-changes';
import { Card } from '@/components/ui/card';

export function ReconcileForm({
  potId,
  accounts,
  transactions,
}: {
  potId: string;
  accounts: PoolAccount[];
  transactions: Transaction[];
}) {
  const active = accounts.filter((a) => a.active);
  const potto = useMemo(() => {
    const map: Record<string, number> = {};
    for (const account of active) map[account.id] = calculateAccountBalance(transactions, account.id);
    return map;
  }, [active, transactions]);

  const [actual, setActual] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const account of active) map[account.id] = String(toRupees(potto[account.id] ?? 0));
    return map;
  });

  const pottoTotal = active.reduce((sum, a) => sum + (potto[a.id] ?? 0), 0);
  const actualTotal = active.reduce((sum, a) => {
    const n = Number(actual[a.id]);
    return sum + (Number.isFinite(n) ? toPaise(n) : 0);
  }, 0);
  const diff = actualTotal - pottoTotal;
  const dirty = active.some((account) => (actual[account.id] ?? '') !== String(toRupees(potto[account.id] ?? 0)));
  useWarnUnsaved(dirty);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Potto balance</p>
        {active.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span>{a.name}</span>
            <span className="font-medium">{formatMoney(potto[a.id] ?? 0)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line pt-2 font-medium">
          <span>Total</span>
          <span>{formatMoney(pottoTotal)}</span>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">Actual balance</p>
        {active.map((a) => (
          <div key={a.id}>
            <Label htmlFor={a.id}>{a.name}</Label>
            <Input
              id={a.id}
              inputMode="decimal"
              value={actual[a.id] ?? ''}
              onChange={(e) => setActual((prev) => ({ ...prev, [a.id]: e.target.value }))}
            />
          </div>
        ))}
        <p className="text-sm text-ink-soft">Actual total {formatMoney(actualTotal)}</p>
      </div>

      {diff !== 0 ? (
        <Card className="space-y-1 border-gold/40 bg-gold-soft/40">
          <p className="font-medium text-ink">Warning</p>
          <p>{formatMoney(Math.abs(diff))} difference found.</p>
          <p className="text-sm text-ink-soft">Potto says: {formatMoney(pottoTotal)}</p>
          <p className="text-sm text-ink-soft">Actual: {formatMoney(actualTotal)}</p>
          <p className="text-sm text-ink-soft">Difference: {formatMoney(diff)}</p>
        </Card>
      ) : (
        <p className="text-sm text-ink-soft">Totals match. Nothing was changed.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/pots/${potId}/transactions`} variant="outline">
          Review transactions
        </ButtonLink>
        <CancelLink href={`/pots/${potId}/pool`} dirty={dirty}>
          Cancel
        </CancelLink>
      </div>
    </div>
  );
}
