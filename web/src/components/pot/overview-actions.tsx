import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownCircle, ArrowLeftRight, CalendarClock, ChevronRight, Receipt } from 'lucide-react';
import type { Transaction } from '@/lib/core/models';
import { PottoIcon } from '@/components/icons/potto-icon';
import { cn } from '@/lib/utils';

export function QuickActionCard({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: 'mint' | 'gold';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-[128px] flex-col gap-3 rounded-[var(--radius-lg)] border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        tone === 'mint'
          ? 'border-accent/10 bg-accent-soft/60 hover:bg-accent-soft/80'
          : 'border-gold/20 bg-gold-soft/35 hover:bg-gold-soft/55',
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-surface',
            tone === 'mint' ? 'text-accent' : 'text-gold',
          )}
        >
          <PottoIcon icon={icon} size={20} />
        </span>
        <PottoIcon icon={ChevronRight} size={18} className="text-ink-soft transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="block">
        <span className="block font-sans text-base font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm leading-5 text-ink-soft">{description}</span>
      </span>
    </Link>
  );
}

export function SecondaryAction({ href, icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <PottoIcon icon={icon} size={16} className="text-ink-soft" />
      {label}
    </Link>
  );
}

export function StatRow({
  icon,
  label,
  value,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="flex items-center gap-2 text-ink-soft">
        <PottoIcon icon={icon} size={16} className={iconClassName} />
        {label}
      </dt>
      <dd className="font-money font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{children}</h2>;
}

const ACTIVITY_ICONS: Partial<Record<Transaction['type'], LucideIcon>> = {
  contribution: ArrowDownCircle,
  pool_expense: Receipt,
  member_expense: Receipt,
  settlement: ArrowLeftRight,
  pool_transfer: ArrowLeftRight,
};

export function activityIcon(type: Transaction['type']): LucideIcon {
  return ACTIVITY_ICONS[type] ?? CalendarClock;
}

export function ActivityRow({
  href,
  icon,
  title,
  meta,
  amount,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
  amount: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 hover:bg-surface-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
        <PottoIcon icon={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-soft">{meta}</span>
      </span>
      <span className="font-money text-sm font-semibold text-ink">{amount}</span>
    </Link>
  );
}
