import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownCircle, ArrowLeftRight, Receipt } from 'lucide-react';
import { CategoryIcon } from '@/components/categories/category-icon';
import { PottoIcon } from '@/components/icons/potto-icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  activityKind,
  activityTitle,
  contributorSummaries,
  expensePayer,
  formatPublicDate,
  groupByDate,
  participantSummary,
  publicContributions,
  publicExpenses,
  type PublicPot,
  type PublicTransaction,
  type PublicTransactionType,
} from '@/lib/core/logic/public-pot';
import { formatMoney, initials } from '@/lib/core/money';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<PublicTransactionType, LucideIcon> = {
  contribution: ArrowDownCircle,
  pool_expense: Receipt,
  member_expense: Receipt,
  settlement: ArrowLeftRight,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</h2>;
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[var(--radius-lg)] border border-line bg-surface p-1', className)}>{children}</div>
  );
}

function TypeBadge({ type }: { type: PublicTransactionType }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
      <PottoIcon icon={TYPE_ICONS[type]} size={18} />
    </span>
  );
}

/** One ledger line. No link, no menu: the public view has nothing to open or change. */
function LedgerRow({
  leading,
  title,
  meta,
  detail,
  amount,
  amountClassName,
}: {
  leading: React.ReactNode;
  title: string;
  meta: string;
  detail?: string;
  amount: string;
  amountClassName?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-soft">{meta}</span>
        {detail ? <span className="line-clamp-2 text-xs text-ink-soft">{detail}</span> : null}
      </span>
      <span className={cn('font-money text-sm font-semibold text-ink', amountClassName)}>{amount}</span>
    </li>
  );
}

function activityRow(tx: PublicTransaction, key: string) {
  const category = tx.category?.name;
  const meta = [activityKind(tx.type), category].filter(Boolean).join(' · ');
  const isContribution = tx.type === 'contribution';
  return (
    <LedgerRow
      key={key}
      leading={<TypeBadge type={tx.type} />}
      title={activityTitle(tx)}
      meta={meta}
      amount={`${isContribution ? '+' : ''}${formatMoney(tx.amount)}`}
      amountClassName={isContribution ? 'text-pos' : undefined}
    />
  );
}

function TruncationNote({ pot }: { pot: PublicPot }) {
  if (!pot.truncated) return null;
  return (
    <p className="mt-3 text-xs text-ink-soft">
      Showing the latest {pot.transactions.length} of {pot.transactionCount} entries. The totals above include everything.
    </p>
  );
}

const MEMBERS_COLLAPSED = 8;

function MemberList({ members }: { members: PublicPot['members'] }) {
  const [expanded, setExpanded] = useState(false);
  if (members.length === 0) return <p className="mt-2 text-sm text-ink-soft">No members yet.</p>;

  const shown = expanded ? members : members.slice(0, MEMBERS_COLLAPSED);
  return (
    <>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {shown.map((member, i) => (
          <li
            key={`${member.name}-${i}`}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2.5"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
            >
              {initials(member.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{member.name}</span>
              <span className="block text-xs text-ink-soft">
                {member.contributed > 0 ? `Contributed ${formatMoney(member.contributed)}` : 'No contributions yet'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {members.length > MEMBERS_COLLAPSED ? (
        <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer members' : `Show all ${members.length} members`}
        </Button>
      ) : null}
    </>
  );
}

export function OverviewPanel({ pot, onViewActivity }: { pot: PublicPot; onViewActivity: () => void }) {
  const recent = pot.transactions.slice(0, 5);
  return (
    <div className="space-y-7">
      <section>
        <SectionLabel>Members</SectionLabel>
        <MemberList members={pot.members} />
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Recent activity</SectionLabel>
          {pot.transactions.length > recent.length ? (
            <Button variant="ghost" size="sm" onClick={onViewActivity}>
              View all activity
            </Button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No activity yet.</p>
        ) : (
          <Panel className="mt-2">
            <ul className="divide-y divide-line">{recent.map((tx, i) => activityRow(tx, `${tx.createdAt}-${i}`))}</ul>
          </Panel>
        )}
      </section>
    </div>
  );
}

export function ActivityPanel({ pot }: { pot: PublicPot }) {
  if (pot.transactions.length === 0) {
    return <EmptyState title="No activity yet" description="Contributions, expenses and settlements will show up here." />;
  }
  const groups = groupByDate(pot.transactions);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.date}>
          <SectionLabel>{formatPublicDate(group.date)}</SectionLabel>
          <Panel className="mt-2">
            <ul className="divide-y divide-line">
              {group.items.map((tx, i) => activityRow(tx, `${group.date}-${tx.createdAt}-${i}`))}
            </ul>
          </Panel>
        </section>
      ))}
      <TruncationNote pot={pot} />
    </div>
  );
}

export function ContributionsPanel({ pot }: { pot: PublicPot }) {
  const contributors = contributorSummaries(pot);
  const contributions = publicContributions(pot);

  if (contributors.length === 0 && contributions.length === 0) {
    return <EmptyState title="No contributions yet" description="Money added to the pot will show up here." />;
  }

  return (
    <div className="space-y-7">
      {contributors.length > 0 ? (
        <section>
          <div className="flex items-baseline justify-between gap-2">
            <SectionLabel>By contributor</SectionLabel>
            <p className="font-money text-sm font-semibold text-ink">{formatMoney(pot.contributed)} total</p>
          </div>
          <ul className="mt-2 space-y-2">
            {contributors.map((c, i) => (
              <li key={`${c.name}-${i}`} className="rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink">{c.name}</span>
                  <span className="font-money font-semibold text-ink">{formatMoney(c.contributed)}</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent-soft"
                  role="img"
                  aria-label={`${Math.round(c.share * 100)}% of all contributions`}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.round(c.share * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contributions.length > 0 ? (
        <section>
          <SectionLabel>All contributions</SectionLabel>
          <Panel className="mt-2">
            <ul className="divide-y divide-line">
              {contributions.map((tx, i) => (
                <LedgerRow
                  key={`${tx.createdAt}-${i}`}
                  leading={<TypeBadge type="contribution" />}
                  title={tx.paidBy ?? 'Someone'}
                  meta={formatPublicDate(tx.date)}
                  detail={tx.description && tx.description !== 'Trip contribution' ? tx.description : undefined}
                  amount={`+${formatMoney(tx.amount)}`}
                  amountClassName="text-pos"
                />
              ))}
            </ul>
          </Panel>
          <TruncationNote pot={pot} />
        </section>
      ) : null}
    </div>
  );
}

export function ExpensesPanel({ pot }: { pot: PublicPot }) {
  const expenses = publicExpenses(pot);
  if (expenses.length === 0) {
    return <EmptyState title="No expenses yet" description="Group spending will show up here." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>Expenses</SectionLabel>
        <p className="font-money text-sm font-semibold text-ink">{formatMoney(pot.spent)} spent</p>
      </div>
      <Panel>
        <ul className="divide-y divide-line">
          {expenses.map((tx, i) => (
            <LedgerRow
              key={`${tx.createdAt}-${i}`}
              leading={
                tx.category ? (
                  <CategoryIcon icon={tx.category.icon} color={tx.category.color} size={36} />
                ) : (
                  <TypeBadge type={tx.type} />
                )
              }
              title={tx.description}
              meta={[formatPublicDate(tx.date), tx.category?.name].filter(Boolean).join(' · ')}
              detail={[expensePayer(tx), participantSummary(tx.participants)].filter(Boolean).join(' · ')}
              amount={formatMoney(tx.amount)}
            />
          ))}
        </ul>
      </Panel>
      <TruncationNote pot={pot} />
    </div>
  );
}
