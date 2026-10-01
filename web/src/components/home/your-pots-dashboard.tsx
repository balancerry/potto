'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import type { MyPotPrefs, PotDisplayStatus, PotListItem } from '@/lib/queries/pots';
import { pinRank, visitTimestamp, type PotVisitMap } from '@/lib/recent-pots';
import { fetchUserPotPrefs } from '@/lib/user-pot-prefs';
import { EmptyPotsState } from '@/components/home/empty-pots-state';
import { PotCard } from '@/components/home/pot-card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | PotDisplayStatus;
type SortKey = 'visited' | 'newest' | 'oldest' | 'name' | 'balance' | 'recent';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Planned' },
  { key: 'archived', label: 'Archived' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'visited', label: 'Most recently visited' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'balance', label: 'Highest pool balance' },
  { key: 'recent', label: 'Most recently active' },
];

function countFor(items: PotListItem[], key: FilterKey): number {
  if (key === 'all') return items.length;
  return items.filter((item) => item.displayStatus === key).length;
}

function matchesSearch(item: PotListItem, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = item.pot.name.toLowerCase();
  const description = (item.pot.description ?? '').toLowerCase();
  return name.includes(q) || description.includes(q);
}

function secondarySort(items: PotListItem[], sort: SortKey, visits: PotVisitMap): PotListItem[] {
  const copy = [...items];
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => a.pot.createdAt.localeCompare(b.pot.createdAt));
    case 'name':
      return copy.sort((a, b) => a.pot.name.localeCompare(b.pot.name, undefined, { sensitivity: 'base' }));
    case 'balance':
      return copy.sort((a, b) => b.poolBalance - a.poolBalance);
    case 'recent':
      return copy.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    case 'visited':
      return copy.sort((a, b) => {
        const diff = visitTimestamp(visits, b.pot.id) - visitTimestamp(visits, a.pot.id);
        if (diff !== 0) return diff;
        return b.pot.createdAt.localeCompare(a.pot.createdAt);
      });
    case 'newest':
    default:
      return copy.sort((a, b) => b.pot.createdAt.localeCompare(a.pot.createdAt));
  }
}

function sortItems(items: PotListItem[], sort: SortKey, visits: PotVisitMap, pins: string[]): PotListItem[] {
  const secondaryOrder = secondarySort(items, sort, visits);
  const indexById = new Map(secondaryOrder.map((item, index) => [item.pot.id, index]));
  return [...items].sort((a, b) => {
    const pinDiff = pinRank(pins, a.pot.id) - pinRank(pins, b.pot.id);
    if (pinDiff !== 0) return pinDiff;
    return (indexById.get(a.pot.id) ?? 0) - (indexById.get(b.pot.id) ?? 0);
  });
}

export function YourPotsDashboard({
  items,
  initialPrefs,
}: {
  items: PotListItem[];
  /** Server-loaded pins/visits so the first paint is already in pinned/visited order. */
  initialPrefs: MyPotPrefs | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('visited');
  const [visits, setVisits] = useState<PotVisitMap>(initialPrefs?.visits ?? {});
  const [pins, setPins] = useState<string[]>(initialPrefs?.pins ?? []);
  const [userId, setUserId] = useState<string | null>(initialPrefs?.userId ?? null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      const prefs = await fetchUserPotPrefs();
      if (cancelled) return;
      setUserId(prefs.userId);
      setVisits(prefs.visits);
      setPins(prefs.pins);
    }

    void loadPrefs();

    function onVisible() {
      if (document.visibilityState === 'visible') void loadPrefs();
    }

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [items]);

  const searched = useMemo(
    () => items.filter((item) => matchesSearch(item, query)),
    [items, query],
  );

  const filtered = useMemo(() => {
    const statusFiltered =
      filter === 'all' ? searched : searched.filter((item) => item.displayStatus === filter);
    return sortItems(statusFiltered, sort, visits, pins);
  }, [searched, filter, sort, visits, pins]);

  const hasPots = items.length > 0;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function onPinsChange(next: string[]) {
    setPins(next);
  }

  return (
    <div className={cn('space-y-8', !hasPots && 'mx-auto w-full max-w-[1040px]')}>
      <div
        className={cn(
          'flex flex-col gap-4 sm:flex-row sm:justify-between',
          hasPots ? 'sm:items-end' : 'sm:items-center',
        )}
      >
        <div className="relative min-w-0">
          {hasPots ? (
            <Compass
              aria-hidden
              strokeWidth={1.25}
              className="pointer-events-none absolute -right-6 -top-6 -z-10 hidden size-28 text-accent/[0.14] sm:block"
            />
          ) : null}
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-[3.1rem]">
            Your pots
          </h1>
          <p className="mt-1 max-w-md text-ink-soft">Group funds for trips, events, and shared expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPots ? (
            <Button type="button" variant="outline" onClick={refresh} disabled={pending} aria-label="Refresh pots">
              <RefreshCw className={cn('size-4', pending && 'animate-spin')} />
              {pending ? 'Refreshing…' : 'Refresh'}
            </Button>
          ) : null}
          <ButtonLink href="/join" variant="outline">
            <Users className="size-4" />
            Join a pot
          </ButtonLink>
          {hasPots ? (
            <ButtonLink href="/pots/new">
              <Plus className="size-4" />
              Create pot
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {!hasPots ? (
        <EmptyPotsState />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative sm:w-64 sm:flex-none">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your pots…"
                aria-label="Search your pots"
                className="border-line bg-paper pl-10 pr-10"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="hidden h-8 w-px shrink-0 bg-line sm:block" aria-hidden />

            <div
              role="tablist"
              aria-label="Filter pots"
              className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:pb-0 [&::-webkit-scrollbar]:hidden"
            >
              {FILTERS.map(({ key, label }) => {
                const selected = filter === key;
                const count = countFor(searched, key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'shrink-0 rounded-[10px] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                      selected
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-paper text-ink-soft hover:border-accent/30 hover:text-ink',
                    )}
                  >
                    {label}
                    <span className={cn('ml-1.5 tabular-nums', selected ? 'text-white/80' : 'text-ink-soft')}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="flex shrink-0 items-center gap-2 text-sm text-ink-soft sm:ml-auto">
              <span className="sr-only">Sort pots</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-10 rounded-[var(--radius-md)] border border-line bg-paper px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
              <h2 className="font-display text-xl font-semibold text-ink">No pots found</h2>
              <p className="mt-2 text-sm text-ink-soft">Try another search or clear your filters.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  >
                    Clear search
                  </button>
                ) : null}
                {filter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="rounded-[var(--radius-md)] border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  >
                    Show all pots
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <li key={item.pot.id}>
                  <PotCard
                    item={item}
                    userId={userId}
                    pinned={pins.includes(item.pot.id)}
                    onPinsChange={onPinsChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
