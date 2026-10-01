'use client';

import { useRouter } from 'next/navigation';
import { CATEGORY_FILTER_NONE } from '@/lib/core/logic/categories';
import type { Member, PotCategory } from '@/lib/core/models';

const TYPES = [
  { value: 'all', label: 'All activity' },
  { value: 'contribution', label: 'Contributions' },
  { value: 'expense', label: 'Expenses' },
  { value: 'settlement', label: 'Settlements' },
  { value: 'transfer', label: 'Transfers' },
];

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export function ActivityFilters({
  potId,
  type,
  member,
  category,
  range,
  from,
  to,
  members,
  categoryOptions,
}: {
  potId: string;
  type: string;
  member: string;
  category: string;
  range: string;
  from?: string;
  to?: string;
  members: Member[];
  /** Active categories plus archived ones still used by history. */
  categoryOptions: PotCategory[];
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');

  function go(next: { type?: string; member?: string; category?: string; range?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const typeValue = next.type ?? type;
    const memberValue = next.member ?? member;
    const categoryValue = next.category ?? category;
    const rangeValue = next.range ?? range;
    const fromValue = next.from ?? from;
    const toValue = next.to ?? to;
    if (typeValue && typeValue !== 'all') params.set('type', typeValue);
    if (memberValue && memberValue !== 'all') params.set('member', memberValue);
    if (categoryValue && categoryValue !== 'all') params.set('category', categoryValue);
    if (rangeValue && rangeValue !== 'all') params.set('range', rangeValue);
    if (rangeValue === 'custom' && fromValue) params.set('from', fromValue);
    if (rangeValue === 'custom' && toValue) params.set('to', toValue);
    const query = params.toString();
    router.replace(query ? `/pots/${potId}/transactions?${query}` : `/pots/${potId}/transactions`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <FilterSelect label="Activity" value={type} onChange={(value) => go({ type: value })}>
        {TYPES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Member" value={member} onChange={(value) => go({ member: value })}>
        <option value="all">All members</option>
        {active.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Category" value={category} onChange={(value) => go({ category: value })}>
        <option value="all">All categories</option>
        {categoryOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.isActive ? c.name : `${c.name} · Archived`}
          </option>
        ))}
        <option value={CATEGORY_FILTER_NONE}>Uncategorized</option>
      </FilterSelect>
      <FilterSelect label="Date" value={range} onChange={(value) => go({ range: value })}>
        {RANGES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </FilterSelect>
      {range === 'custom' ? (
        <>
          <label className="text-sm text-ink-soft">
            <span className="mb-1 block text-xs font-medium">From</span>
            <input
              type="date"
              value={from ?? ''}
              onChange={(event) => go({ from: event.target.value })}
              className="h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            />
          </label>
          <label className="text-sm text-ink-soft">
            <span className="mb-1 block text-xs font-medium">To</span>
            <input
              type="date"
              value={to ?? ''}
              onChange={(event) => go({ to: event.target.value })}
              className="h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm text-ink-soft">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {children}
      </select>
    </label>
  );
}
