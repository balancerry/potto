'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import {
  ActivityPanel,
  ContributionsPanel,
  ExpensesPanel,
  OverviewPanel,
} from '@/components/public/public-pot-sections';
import { PottoIcon } from '@/components/icons/potto-icon';
import { Badge } from '@/components/ui/badge';
import type { PublicPot } from '@/lib/core/logic/public-pot';
import { formatMoney } from '@/lib/core/money';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'expenses', label: 'Expenses' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'neg' }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-sunk px-3.5 py-3">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-money text-xl font-bold text-ink sm:text-2xl',
          tone === 'accent' && 'text-accent',
          tone === 'neg' && 'text-neg',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Anonymous, read-only pot. Everything is already in `pot` (one server round
 * trip), so tab changes are instant. There are intentionally no action buttons,
 * not even disabled ones.
 */
export function PublicPotView({ pot }: { pot: PublicPot }) {
  const [tab, setTab] = useState<TabId>('overview');
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // Honour #activity etc. after hydration (and when the hash changes) so a shared tab link lands where it should.
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      return isTabId(hash) ? hash : null;
    };
    const initial = fromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hash is only readable on the client
    if (initial) setTab(initial);
    const onHashChange = () => setTab(fromHash() ?? 'overview');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const select = useCallback((next: TabId, focus = false) => {
    setTab(next);
    const url = next === 'overview' ? window.location.pathname + window.location.search : `#${next}`;
    window.history.replaceState(null, '', url);
    if (focus) tabRefs.current[next]?.focus();
  }, []);

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    select(TABS[target].id, true);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <PottoIcon icon={Eye} size={16} className="size-3.5" />
            Read-only view
          </span>
          {pot.archived ? <Badge tone="gold">Archived</Badge> : null}
        </div>
        <h1 className="mt-3 break-words font-display text-3xl font-bold text-ink sm:text-4xl">{pot.name}</h1>
        {pot.description ? <p className="mt-2 max-w-prose whitespace-pre-line text-ink-soft">{pot.description}</p> : null}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={pot.memberCount === 1 ? 'Member' : 'Members'} value={String(pot.memberCount)} />
          <Stat label="Contributed" value={formatMoney(pot.contributed)} />
          <Stat label="Spent" value={formatMoney(pot.spent)} />
          <Stat label="Remaining" value={formatMoney(pot.balance)} tone={pot.balance < 0 ? 'neg' : 'accent'} />
        </dl>
      </section>

      <div role="tablist" aria-label="Pot sections" className="flex items-center gap-0.5 overflow-x-auto sm:gap-1">
        {TABS.map((item, index) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:px-3',
                selected ? 'bg-accent text-on-accent' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
        {tab === 'overview' ? <OverviewPanel pot={pot} onViewActivity={() => select('activity')} /> : null}
        {tab === 'activity' ? <ActivityPanel pot={pot} /> : null}
        {tab === 'contributions' ? <ContributionsPanel pot={pot} /> : null}
        {tab === 'expenses' ? <ExpensesPanel pot={pot} /> : null}
      </div>
    </div>
  );
}
