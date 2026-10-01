import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MemberProfileActions } from '@/components/pot/member-profile-actions';
import { Card } from '@/components/ui/card';
import { calculateContributionSummaries, explainBalance, sortTransactionsRecentFirst } from '@/lib/core/logic/accounting';
import { canInvite, canManageMembers } from '@/lib/core/logic/permissions';
import { formatDate, formatDateFull, formatMoney, initials } from '@/lib/core/money';
import { withReturn } from '@/lib/navigation/pot-trail';
import { getPotBundle } from '@/lib/queries/pots';
import type { MemberRole, PoolAccount, Transaction } from '@/lib/core/models';

function roleLabel(role: MemberRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

function involves(tx: Transaction, memberId: string): boolean {
  if (tx.paidBy === memberId || tx.toMember === memberId) return true;
  return (tx.splits ?? []).some((split) => split.memberId === memberId);
}

function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function whenLabel(iso: string): string {
  const day = iso.slice(0, 10);
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return formatDate(iso);
}

function accountLabel(tx: Transaction, accounts: PoolAccount[]): string | undefined {
  const account = accounts.find((item) => item.id === tx.poolAccountId);
  if (account) return account.name;
  if (tx.receivedVia === 'cash') return 'Cash';
  if (tx.receivedVia === 'online') return 'Pool Bank';
  return undefined;
}

function activityLine(tx: Transaction, memberId: string): { title: string; detail: string } {
  if (tx.type === 'contribution' && tx.paidBy === memberId) {
    return { title: `Added ${formatMoney(tx.amount)}`, detail: 'Contribution' };
  }
  if (tx.type === 'member_expense' && tx.paidBy === memberId) {
    return { title: `Paid ${formatMoney(tx.amount)}`, detail: `${tx.description} · Personal expense` };
  }
  if (tx.type === 'member_expense') {
    return { title: tx.description, detail: `Personal expense · ${formatMoney(tx.amount)}` };
  }
  if (tx.type === 'pool_expense') {
    return { title: tx.description, detail: `Pool expense · ${formatMoney(tx.amount)}` };
  }
  if (tx.type === 'settlement' && tx.paidBy === memberId) {
    return { title: `Paid ${formatMoney(tx.amount)}`, detail: 'Settlement' };
  }
  if (tx.type === 'settlement') {
    return { title: `Received ${formatMoney(tx.amount)}`, detail: 'Settlement' };
  }
  if (tx.type === 'pool_transfer') {
    return { title: `Transferred ${formatMoney(tx.amount)}`, detail: 'Transfer' };
  }
  return { title: tx.description, detail: formatMoney(tx.amount) };
}

function signed(amount: number, sign: '+' | '−'): string {
  return `${sign}${formatMoney(amount)}`;
}

export const metadata = { title: 'Member' };

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

  const memberHere = `/pots/${id}/balance?memberId=${memberId}`;
  const expl = explainBalance(bundle.transactions, memberId);
  const summary = calculateContributionSummaries([member], bundle.transactions)[0];
  const contributed = summary?.total ?? expl.contributed;
  const contributionCount = summary?.count ?? 0;
  const viewer = bundle.currentMember ?? undefined;
  const canManage = canManageMembers(viewer);
  const personalExpenses = sortTransactionsRecentFirst(bundle.transactions).filter(
    (tx) => tx.type === 'member_expense' && tx.paidBy === memberId,
  );
  const contributions = sortTransactionsRecentFirst(bundle.transactions).filter(
    (tx) => tx.type === 'contribution' && tx.paidBy === memberId,
  );
  const activity = sortTransactionsRecentFirst(bundle.transactions).filter((tx) => involves(tx, memberId));
  const settlementRelevant =
    expl.contributed !== 0 ||
    expl.expenseShare !== 0 ||
    expl.paidForGroup !== 0 ||
    expl.settlementsSent !== 0 ||
    expl.settlementsReceived !== 0;
  const settlement =
    expl.net < 0
      ? `${formatMoney(Math.abs(expl.net))} to add`
      : expl.net > 0
        ? `${formatMoney(expl.net)} to receive`
        : settlementRelevant
          ? 'Settled'
          : 'Nothing yet';
  const firstName = member.name.trim().split(/\s+/)[0] || member.name;
  const preview = 5;

  return (
    <div className="space-y-8">
      <MemberProfileActions
        potId={id}
        member={member}
        canEdit={canManage && member.status === 'active'}
        canRemove={canManage && member.status === 'active' && member.role === 'member'}
        canLink={canInvite(viewer) && !member.userId}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
            {initials(member.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-sans text-2xl font-semibold text-ink">{member.name}</h2>
            <p className="text-sm text-ink-soft">
              {roleLabel(member.role)}
              {member.accessLevel === 'view_only' ? ' · View only' : ''}
              {!member.userId ? ' · Unlinked' : ''}
            </p>
            {member.userId ? <p className="text-sm text-ink-soft">Account linked</p> : null}
            <p className="mt-1 text-sm text-ink-soft">
              {roleLabel(member.role)} in {bundle.pot.name}
            </p>
          </div>
        </div>
      </MemberProfileActions>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Financial snapshot</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Contributed</p>
            <p className="mt-2 font-money text-2xl font-bold text-ink">{formatMoney(contributed)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {contributionCount} {contributionCount === 1 ? 'contribution' : 'contributions'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Personal expenses</p>
            <p className="mt-2 font-money text-2xl font-bold text-ink">{formatMoney(expl.paidForGroup)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {personalExpenses.length > 0
                ? `${personalExpenses.length} ${personalExpenses.length === 1 ? 'expense' : 'expenses'}`
                : 'None yet'}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Settlement</p>
            <p className="mt-2 font-money text-2xl font-bold text-ink">
              {settlement === 'Settled' ? '✓ Settled' : settlement}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {settlement === 'Nothing yet'
                ? 'No settlement yet'
                : settlement === 'Settled'
                  ? 'Nothing outstanding'
                  : 'Current position'}
            </p>
          </Card>
        </div>
      </section>

      {contributions.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Contributions</h3>
            <p className="text-sm text-ink-soft">
              {formatMoney(contributed)} total · {contributionCount}{' '}
              {contributionCount === 1 ? 'contribution' : 'contributions'}
            </p>
          </div>
          <ul className="divide-y divide-line">
            {contributions.slice(0, preview).map((tx) => {
              const where = accountLabel(tx, bundle.poolAccounts);
              return (
                <li key={tx.id}>
                  <Link
                    href={withReturn(`/pots/${id}/transactions/${tx.id}`, memberHere)}
                    className="flex items-baseline justify-between gap-4 py-3 hover:text-accent"
                  >
                    <span>
                      <span className="block text-sm text-ink-soft">{whenLabel(tx.date)}</span>
                      {where ? <span className="text-sm text-ink">{where}</span> : null}
                    </span>
                    <span className="font-money font-semibold text-ink">{formatMoney(tx.amount)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {contributions.length > preview ? (
            <Link
              href={`/pots/${id}/transactions?type=contribution&member=${memberId}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              View all contributions
            </Link>
          ) : null}
        </section>
      ) : null}

      {personalExpenses.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Personal expenses</h3>
            <p className="text-sm text-ink-soft">
              {formatMoney(expl.paidForGroup)} total · {personalExpenses.length}{' '}
              {personalExpenses.length === 1 ? 'expense' : 'expenses'}
            </p>
          </div>
          <p className="text-sm text-ink-soft">Paid by {firstName}, not from the Pot.</p>
          <ul className="divide-y divide-line">
            {personalExpenses.slice(0, preview).map((tx) => (
              <li key={tx.id}>
                <Link
                  href={withReturn(`/pots/${id}/transactions/${tx.id}`, memberHere)}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <span>
                    <span className="block font-medium text-ink">{tx.description}</span>
                    <span className="text-sm text-ink-soft">Paid personally · {whenLabel(tx.date)}</span>
                  </span>
                  <span className="font-money font-semibold text-ink">{formatMoney(tx.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {personalExpenses.length > preview ? (
            <Link
              href={`/pots/${id}/transactions?type=expense&member=${memberId}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              View all expenses
            </Link>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Activity</h3>
          {activity.length === 0 ? (
            <div className="max-w-prose">
              <p className="font-medium text-ink">No activity yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                {firstName} hasn&apos;t added money or recorded an expense in this Pot yet.
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                Once they participate, their contributions, expenses and settlements will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {groupByDay(activity).map((group) => (
                <li key={group.label}>
                  <p className="text-xs font-medium text-ink-soft">{group.label}</p>
                  <ul className="mt-1 divide-y divide-line">
                    {group.items.map((tx) => {
                      const line = activityLine(tx, memberId);
                      return (
                        <li key={tx.id}>
                          <Link
                            href={withReturn(`/pots/${id}/transactions/${tx.id}`, memberHere)}
                            className="block py-2.5 hover:text-accent"
                          >
                            <span className="block text-sm font-medium text-ink">{line.title}</span>
                            <span className="text-xs text-ink-soft">{line.detail}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Member information</h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ink-soft">Role</dt>
              <dd className="font-medium text-ink">{roleLabel(member.role)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Account</dt>
              <dd className="font-medium text-ink">{member.userId ? 'Linked' : 'Not linked'}</dd>
            </div>
            {member.joinedAt ? (
              <div>
                <dt className="text-ink-soft">Joined</dt>
                <dd className="font-medium text-ink">{formatDateFull(member.joinedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <details className="max-w-md text-sm text-ink-soft">
        <summary className="cursor-pointer font-medium text-ink hover:text-accent">
          How this member&apos;s balance works
        </summary>
        <dl className="mt-3 space-y-2">
          <Row label="Contributions" value={signed(expl.contributed, '+')} />
          <Row label="Share of group expenses" value={signed(expl.expenseShare, '−')} />
          <Row label="Paid personally for the group" value={signed(expl.paidForGroup, '+')} />
          {expl.settlementsSent !== 0 ? <Row label="Settlements sent" value={signed(expl.settlementsSent, '+')} /> : null}
          {expl.settlementsReceived !== 0 ? (
            <Row label="Settlements received" value={signed(expl.settlementsReceived, '−')} />
          ) : null}
          <Row
            label="Current position"
            value={expl.net === 0 ? formatMoney(0) : formatMoney(expl.net, { showSign: true })}
          />
          <Row label="Settlement" value={settlement === 'Settled' ? '✓ Settled' : settlement} />
        </dl>
      </details>
    </div>
  );
}

function groupByDay(transactions: Transaction[]): { label: string; items: Transaction[] }[] {
  const groups: { label: string; items: Transaction[] }[] = [];
  for (const tx of transactions) {
    const label = whenLabel(tx.date);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(tx);
    else groups.push({ label, items: [tx] });
  }
  return groups;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
