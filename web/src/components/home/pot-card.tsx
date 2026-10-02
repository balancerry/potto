'use client';

import Link from 'next/link';
import { ArrowRight, Pin } from 'lucide-react';
import { formatMoney, initials } from '@/lib/core/money';
import type { PotDisplayStatus, PotListItem } from '@/lib/queries/pots';
import { PotCardMenu } from '@/components/home/pot-card-menu';
import { LinkPendingHint, useIsLinkPending } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<PotDisplayStatus, string> = {
  active: 'Active',
  upcoming: 'Planned',
  archived: 'Archived',
};

function MemberAvatars({ names }: { names: string[] }) {
  const shown = names.slice(0, 4);
  const overflow = names.length - shown.length;

  return (
    <div className="flex items-center gap-3">
      <ul className="flex -space-x-2" aria-hidden>
        {shown.map((name, index) => (
          <li
            key={`${name}-${index}`}
            title={name}
            className={cn(
              'flex size-8 items-center justify-center rounded-[10px] border-2 border-surface text-[10px] font-semibold',
              avatarTone(name),
            )}
          >
            {initials(name)}
          </li>
        ))}
        {overflow > 0 ? (
          <li className="flex size-8 items-center justify-center rounded-[10px] border-2 border-surface bg-surface-sunk text-[10px] font-semibold text-ink-soft">
            +{overflow}
          </li>
        ) : null}
      </ul>
      <p className="text-sm text-ink-soft">
        {names.length} member{names.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function avatarTone(name: string): string {
  // Cycle through Potto's own palette only — no semantic (pos/neg) colors here,
  // those are reserved for balance states, not decorative member identity.
  const tones = [
    'bg-accent text-on-accent',
    'bg-accent-soft text-accent',
    'bg-gold-soft text-gold',
    'bg-ink text-paper',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[hash]!;
}

function StatusMark({ status }: { status: PotDisplayStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide',
        status === 'archived' && 'text-ink-soft',
        status === 'upcoming' && 'text-gold',
        status === 'active' && 'text-accent',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          status === 'archived' && 'border border-ink-soft/50 bg-transparent',
          status === 'upcoming' && 'border border-gold bg-transparent',
          status === 'active' && 'bg-accent',
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function CardPendingWash() {
  const pending = useIsLinkPending();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="absolute inset-0 z-[1] rounded-[var(--radius-lg)] bg-surface/50 transition-opacity"
    />
  );
}

function OpenPotLabel() {
  const pending = useIsLinkPending();
  return (
    <>
      {pending ? 'Opening…' : 'Open pot'}
      {pending ? <LinkPendingHint /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </>
  );
}

export function PotCard({
  item,
  userId = null,
  pinned = false,
  onPinsChange,
}: {
  item: PotListItem;
  userId?: string | null;
  pinned?: boolean;
  onPinsChange?: (pins: string[]) => void;
}) {
  const { pot, poolBalance, contributed, spent, displayStatus, permissions } = item;
  const activeMembers = pot.members.filter((m) => m.status === 'active');
  const memberNames = activeMembers.map((m) => m.name);
  const isShort = poolBalance < 0;
  const isEmptyPool = contributed === 0 && spent === 0;
  const href = `/pots/${pot.id}`;

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-sm transition',
        'hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-md',
        'focus-within:border-accent/30 focus-within:shadow-md',
        pinned && 'border-accent/35 ring-1 ring-accent/15',
      )}
    >
      {/* Stretch link makes the card openable without capturing menu/button clicks */}
      <Link
        href={href}
        prefetch
        className="absolute inset-0 z-0 rounded-[var(--radius-lg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/40"
        aria-label={`Open ${pot.name}`}
      >
        <CardPendingWash />
      </Link>

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusMark status={displayStatus} />
          {pinned ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
              <Pin className="size-3 fill-current" aria-hidden />
              Pinned
            </span>
          ) : null}
        </div>
        <PotCardMenu
          potId={pot.id}
          potName={pot.name}
          permissions={permissions}
          userId={userId}
          pinned={pinned}
          onPinsChange={onPinsChange}
        />
      </div>

      <div className="pointer-events-none relative z-0 mt-4 min-w-0 flex-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink transition-colors group-hover:text-accent">
          <span className="line-clamp-2">{pot.name}</span>
        </h2>
        {pot.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{pot.description}</p>
        ) : null}
      </div>

      <div className="pointer-events-none relative mt-5">
        <MemberAvatars names={memberNames} />
      </div>

      <dl className="pointer-events-none relative mt-5 border-t border-line/80 pt-4">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">Pool balance</dt>
          <dd
            className={cn(
              'mt-1 font-money text-[28px] font-bold leading-none',
              isShort ? 'text-neg' : 'text-accent',
            )}
          >
            {formatMoney(poolBalance)}
          </dd>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">Contributed</dt>
            <dd className="mt-1 font-money text-[15px] font-semibold text-ink">{formatMoney(contributed)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">Spent</dt>
            <dd className="mt-1 font-money text-[15px] font-semibold text-ink">{formatMoney(spent)}</dd>
          </div>
        </div>
      </dl>

      {contributed > 0 ? (
        <div
          className="pointer-events-none relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent-soft/70"
          role="progressbar"
          aria-label="Spent of contributed"
          aria-valuenow={Math.min(100, Math.round((spent / contributed) * 100))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${Math.min(100, Math.round((spent / contributed) * 100))}%` }}
          />
        </div>
      ) : null}

      <div className="pointer-events-none relative mt-2 min-h-4">
        {isShort ? (
          <p className="text-xs font-medium text-neg">Pool is short</p>
        ) : isEmptyPool ? (
          <p className="text-xs italic text-ink-soft">No money added yet</p>
        ) : null}
      </div>

      <div className="relative z-10 mt-4">
        <Link
          href={href}
          prefetch
          className={cn(
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border-[1.5px] border-accent/60 bg-surface text-sm font-semibold text-accent transition-colors',
            'hover:border-accent hover:bg-accent hover:text-on-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
          )}
        >
          <OpenPotLabel />
        </Link>
      </div>
    </article>
  );
}

export function PotCardSkeleton() {
  return (
    <div className="h-[320px] animate-pulse rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <div className="h-3 w-16 rounded bg-surface-sunk" />
      <div className="mt-5 h-6 w-2/3 rounded bg-surface-sunk" />
      <div className="mt-2 h-4 w-full rounded bg-surface-sunk" />
      <div className="mt-6 flex gap-2">
        <div className="size-8 rounded-full bg-surface-sunk" />
        <div className="size-8 rounded-full bg-surface-sunk" />
        <div className="size-8 rounded-full bg-surface-sunk" />
      </div>
      <div className="mt-8 h-7 w-1/2 rounded bg-surface-sunk" />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="h-5 rounded bg-surface-sunk" />
        <div className="h-5 rounded bg-surface-sunk" />
      </div>
      <div className="mt-6 h-10 rounded-[var(--radius-md)] bg-surface-sunk" />
    </div>
  );
}
