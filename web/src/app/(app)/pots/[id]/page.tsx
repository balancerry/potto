import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  calculatePoolBalance,
  calculateTotalContributions,
  calculateTotalSpent,
  sortTransactionsRecentFirst,
} from '@/lib/core/logic/accounting';
import { calculateCommitmentRemaining, calculateTotalUpcomingRemaining } from '@/lib/core/logic/commitments';
import { getPotNextAction } from '@/lib/core/logic/next-up';
import { withReturn } from '@/lib/navigation/pot-trail';
import { calculateAccountBalance } from '@/lib/core/logic/pool-money';
import {
  canAddExpense,
  canAddMoney,
  canCreateCommitment,
  canInvite,
  canManagePoolMoney,
} from '@/lib/core/logic/permissions';
import { formatDate, formatMoney } from '@/lib/core/money';
import { getPotBundle } from '@/lib/queries/pots';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Landmark,
  Receipt,
  Wallet,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react';
import { PottoIcon } from '@/components/icons/potto-icon';
import {
  ActivityRow,
  QuickActionCard,
  SecondaryAction,
  SectionLabel,
  StatRow,
  activityIcon,
} from '@/components/pot/overview-actions';
import { ButtonLink } from '@/components/ui/button';
import type { Transaction } from '@/lib/core/models';

function actionHref(potId: string, target: string, commitmentId?: string): string {
  switch (target) {
    case 'add_contribution':
      return withReturn(`/pots/${potId}/add-money`, `/pots/${potId}`);
    case 'view_contributions':
      return `/pots/${potId}/transactions?type=contribution`;
    case 'record_payment':
      return commitmentId ? `/pots/${potId}/commitments/${commitmentId}` : `/pots/${potId}/commitments`;
    case 'settle':
      return `/pots/${potId}/settle`;
    case 'invite':
      return `/pots/${potId}/invite`;
    default:
      return `/pots/${potId}/summary`;
  }
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

function activityKind(type: Transaction['type']): string {
  if (type === 'contribution') return 'Contribution';
  if (type === 'pool_expense' || type === 'member_expense') return 'Expense';
  if (type === 'settlement') return 'Settlement';
  if (type === 'pool_transfer') return 'Transfer';
  return 'Activity';
}

function activityTitle(tx: Transaction, nameOf: (id?: string) => string): string {
  if (tx.type === 'contribution') return `${nameOf(tx.paidBy)} added ${formatMoney(tx.amount)}`;
  if (tx.type === 'settlement') return `${nameOf(tx.paidBy)} paid ${nameOf(tx.toMember)}`;
  if (tx.type === 'pool_transfer') return 'Pool transfer';
  return tx.description;
}

export default async function PotDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const {
    pot,
    members,
    transactions,
    commitments,
    commitmentPayments,
    poolAccounts,
    poolManagerMemberId,
    currentMember,
  } = bundle;
  const poolBalance = calculatePoolBalance(transactions);
  const contributed = calculateTotalContributions(transactions);
  const spent = calculateTotalSpent(transactions);
  const upcomingRemaining = calculateTotalUpcomingRemaining(commitments, commitmentPayments, transactions);
  const next = getPotNextAction({
    members,
    transactions,
    commitments,
    commitmentPayments,
    expectedContributionPerMember: pot.expectedContributionPerMember,
  });
  const recent = sortTransactionsRecentFirst(transactions).slice(0, 5);
  const canWriteExpense = canAddExpense(currentMember ?? undefined, poolManagerMemberId);
  const canUpcoming = canCreateCommitment(currentMember ?? undefined);
  const canTransfer = canManagePoolMoney(currentMember ?? undefined, poolManagerMemberId) && poolBalance > 0;
  const accounts = poolAccounts.filter((a) => a.active);
  const accountBalances = accounts.map((account) => ({
    account,
    balance: calculateAccountBalance(transactions, account.id),
  }));
  const showAccounts = accountBalances.some((row) => row.balance !== 0);
  const nameOf = (memberId?: string) => members.find((m) => m.id === memberId)?.name ?? 'Someone';
  const me = currentMember ?? undefined;
  const canFollow = (target: string) => {
    if (target === 'invite') return canInvite(me);
    if (target === 'add_contribution') return canAddMoney(me, poolManagerMemberId);
    return true;
  };
  const primaryHref = actionHref(id, next.target, next.commitmentId);
  const secondaryHref = next.secondaryTarget ? actionHref(id, next.secondaryTarget) : null;

  const here = `/pots/${id}`;
  const active = pot.status === 'active';
  const showExpense = active && canWriteExpense;
  const showContribution = active && canAddMoney(me, poolManagerMemberId);
  const secondary = active
    ? [
        canUpcoming
          ? {
              href: withReturn(`/pots/${id}/commitments/new`, here),
              label: 'Add planned payment',
              icon: CalendarClock,
            }
          : null,
        canTransfer
          ? {
              href: `/pots/${id}/pool/transfer`,
              label: 'Transfer money',
              icon: ArrowLeftRight,
            }
          : null,
      ].filter(
        (
          item,
        ): item is {
          href: string;
          label: string;
          icon: typeof CalendarClock;
        } => item != null,
      )
    : [];

  const upcoming = commitments
    .map((c) => ({
      c,
      remaining: calculateCommitmentRemaining(c, commitmentPayments, transactions),
    }))
    .filter(({ c, remaining }) => c.status !== 'cancelled' && remaining > 0)
    .sort((a, b) => (a.c.dueDate ?? '9999').localeCompare(b.c.dueDate ?? '9999'))
    .slice(0, 3);

  const card = 'rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-4';

  return (
    <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-x-5">
      <div className="contents lg:flex lg:flex-col lg:gap-7">
        <section className={`${card} order-1 lg:order-none`}>
          <SectionLabel>Next up</SectionLabel>
          <h2 className="mt-1.5 font-sans text-xl font-semibold text-ink">{next.title}</h2>
          {next.amountPaise != null ? (
            <p className="mt-3 font-money text-2xl font-bold text-ink">
              {formatMoney(next.amountPaise)}{' '}
              <span className="text-base font-medium text-ink-soft">{next.amountLabel}</span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-ink-soft">{next.description}</p>
          {next.supporting ? <p className="mt-2 text-sm text-ink-soft">{next.supporting}</p> : null}
          {next.type !== 'complete' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {canFollow(next.target) ? <ButtonLink href={primaryHref}>{next.primaryLabel}</ButtonLink> : null}
              {next.secondaryLabel && secondaryHref && next.secondaryTarget && canFollow(next.secondaryTarget) ? (
                <ButtonLink href={secondaryHref} variant="outline">
                  {next.secondaryLabel}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </section>

        {showExpense || showContribution || secondary.length > 0 ? (
          <section className="order-3 lg:order-none">
            <SectionLabel>Quick actions</SectionLabel>
            <p className="mt-1 text-sm text-ink-soft">Keep your Pot updated with the latest activity.</p>
            {showExpense || showContribution ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {showExpense ? (
                  <QuickActionCard
                    href={withReturn(`/pots/${id}/add-expense`, here)}
                    icon={Receipt}
                    title="Add expense"
                    description="Record a payment made for the group."
                    tone="mint"
                  />
                ) : null}
                {showContribution ? (
                  <QuickActionCard
                    href={withReturn(`/pots/${id}/add-money`, here)}
                    icon={CircleDollarSign}
                    title="Add contribution"
                    description="Add money to the Pot from a member."
                    tone="gold"
                  />
                ) : null}
              </div>
            ) : null}
            {secondary.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {secondary.map((item) => (
                  <SecondaryAction key={item.label} href={item.href} icon={item.icon} label={item.label} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="order-5 lg:order-none">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Recent activity</SectionLabel>
            {recent.length > 0 ? (
              <Link href={`/pots/${id}/transactions`} className="text-sm font-medium text-accent hover:underline">
                View all activity
              </Link>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <div className="mt-2">
              <p className="font-medium text-ink">No activity yet.</p>
              <p className="mt-1 max-w-prose text-sm text-ink-soft">
                Add a contribution or expense when the group starts using the Pot.
              </p>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface p-1">
              {recent.map((tx) => (
                <li key={tx.id}>
                  <ActivityRow
                    href={withReturn(`/pots/${id}/transactions/${tx.id}`, here)}
                    icon={activityIcon(tx.type)}
                    title={activityTitle(tx, nameOf)}
                    meta={`${whenLabel(tx.date)} · ${activityKind(tx.type)}`}
                    amount={formatMoney(tx.amount)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-7">
        <section className={`${card} order-2 lg:order-none`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Pool</SectionLabel>
              <p className="mt-2 font-money text-4xl font-bold text-accent">{formatMoney(poolBalance)}</p>
            </div>
            <Link
              href={`/pots/${id}/pool`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-surface-sunk px-3 text-sm font-medium text-ink hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <PottoIcon icon={Landmark} size={16} />
              Pool Bank
              <PottoIcon icon={ChevronRight} size={16} className="text-ink-soft" />
            </Link>
          </div>
          <dl className="mt-4 space-y-2">
            <StatRow
              icon={ArrowDownCircle}
              iconClassName="text-accent/80"
              label="Collected"
              value={formatMoney(contributed)}
            />
            <StatRow icon={ArrowUpCircle} iconClassName="text-ink-soft" label="Spent" value={formatMoney(spent)} />
            <StatRow
              icon={Clock3}
              iconClassName="text-gold/80"
              label="Planned"
              value={formatMoney(upcomingRemaining)}
            />
            {showAccounts
              ? accountBalances.map(({ account, balance }) => (
                  <StatRow
                    key={account.id}
                    icon={account.type === 'cash' ? Wallet : Landmark}
                    iconClassName="text-ink-soft"
                    label={account.type === 'cash' ? 'Cash' : 'Bank'}
                    value={formatMoney(balance)}
                  />
                ))
              : null}
          </dl>
        </section>

        <section className={`${card} order-4 lg:order-none`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold text-ink">
              <PottoIcon icon={CalendarClock} size={18} className="text-gold" />
              Coming up
            </h2>
            <Link href={`/pots/${id}/commitments`} className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-4 text-center">
              <p className="font-medium text-ink">Nothing planned yet</p>
              <p className="mx-auto mt-1 max-w-[16rem] text-sm text-ink-soft">
                Add a planned payment to keep your group on track.
              </p>
              {active && canUpcoming ? (
                <ButtonLink href={withReturn(`/pots/${id}/commitments/new`, here)} variant="outline" className="mt-4">
                  Add planned payment
                </ButtonLink>
              ) : null}
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.map(({ c, remaining }) => (
                <li key={c.id}>
                  <Link
                    href={`/pots/${id}/commitments/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] py-2.5 hover:bg-surface-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{c.title}</span>
                      <span className="block text-xs text-ink-soft">
                        {c.dueDate ? `Due ${formatDate(c.dueDate)}` : 'No due date'}
                      </span>
                    </span>
                    <span className="font-money text-sm font-semibold text-ink">{formatMoney(remaining)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
