'use client';

import { Button } from '@/components/ui/button';
import { buildPotSummaryHtml } from '@/lib/core/logic/pot-summary-html';
import type { PotSummaryViewModel } from '@/lib/core/logic/pot-summary';
import { formatMoney } from '@/lib/core/money';

export function SummaryView({ vm }: { vm: PotSummaryViewModel }) {
  function onPrint() {
    const html = buildPotSummaryHtml(vm);
    const w = window.open('', '_blank');
    if (!w) {
      window.print();
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Summary</h2>
          <p className="mt-1 text-sm text-ink-soft">Printable overview of this pot&apos;s finances.</p>
        </div>
        <Button onClick={onPrint}>Print / Save PDF</Button>
      </div>

      <div className="space-y-6 rounded-[var(--radius-lg)] border border-line bg-surface p-6 print:border-0 print:p-0">
        <div>
          <h3 className="font-display text-xl font-semibold">{vm.potName}</h3>
          <p className="mt-1 text-sm text-ink-soft">{vm.memberCount} members</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Contributed" value={formatMoney(vm.pool.contributed)} />
          <Stat label="Spent" value={formatMoney(vm.pool.totalSpent)} />
          <Stat label="Pool" value={formatMoney(vm.pool.balance)} />
        </div>

        <Section title="Contributions by member">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-2 font-medium">Member</th>
                <th className="py-2 font-medium">Total</th>
                <th className="py-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {vm.contributions.members.map((m) => (
                <tr key={m.memberId} className="border-b border-line/60">
                  <td className="py-2">{m.name}</td>
                  <td className="py-2">{formatMoney(m.total)}</td>
                  <td className="py-2">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Pool expenses by category">
          {vm.expenses.categories.length === 0 ? (
            <p className="text-sm text-ink-soft">No pool expenses yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {vm.expenses.categories.map((c) => (
                <li key={c.category} className="flex justify-between gap-4">
                  <span>
                    {c.category} <span className="text-ink-soft">({c.percentage}%)</span>
                  </span>
                  <span>{formatMoney(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming payments">
          {vm.upcoming.items.length === 0 ? (
            <p className="text-sm text-ink-soft">None remaining.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {vm.upcoming.items.map((u) => (
                <li key={u.id} className="flex justify-between gap-4">
                  <span>{u.title}</span>
                  <span>{formatMoney(u.remaining)} left</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Balances">
          <ul className="space-y-2 text-sm">
            {vm.balances.map((b) => (
              <li key={b.memberId} className="flex justify-between gap-4">
                <span>{b.name}</span>
                <span className={b.balance >= 0 ? 'text-pos' : 'text-neg'}>
                  {formatMoney(b.balance, { showSign: true })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-sunk p-4">
      <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 font-display text-lg font-semibold text-ink">{title}</h4>
      {children}
    </section>
  );
}
