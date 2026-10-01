'use client';

import Link from 'next/link';
import { categoriesForPicker, categoryColorHex, categoryTint } from '@/lib/core/logic/categories';
import type { PotCategory } from '@/lib/core/models';
import { CategoryGlyph } from '@/components/categories/category-icon';
import { cn } from '@/lib/utils';

/**
 * Single-select category picker for expense and upcoming-payment forms. Offers
 * the Pot's active categories plus the record's own category when it has since
 * been archived (shown selected, labelled "Archived"). Clicking the selected
 * one clears it (Uncategorized). With no active categories it explains why
 * instead of rendering an empty list.
 */
export function CategoryPicker({
  potId,
  categories,
  value,
  onChange,
  canManage,
}: {
  potId: string;
  categories: PotCategory[];
  value?: string;
  onChange: (categoryId: string | undefined) => void;
  /** Show the "Customize categories" link (owner/admin only). */
  canManage: boolean;
}) {
  const options = categoriesForPicker(categories, value);
  const manageHref = `/pots/${potId}/settings/categories`;

  if (options.length === 0) {
    return (
      <div className="mt-2 rounded-[var(--radius-md)] border border-line bg-surface-sunk p-4 text-sm">
        <p className="font-medium text-ink">No active categories</p>
        <p className="mt-1 text-ink-soft">
          {canManage
            ? 'Create a category to organize this Pot’s expenses. You can still save without one.'
            : 'A pot admin can add categories. You can still save without one.'}
        </p>
        {canManage ? (
          <Link href={manageHref} className="mt-2 inline-flex min-h-9 items-center font-semibold text-accent hover:underline">
            + Add category
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Category">
        {options.map((c) => {
          const selected = c.id === value;
          const fg = categoryColorHex(c.color);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : c.id)}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                selected ? 'text-ink' : 'border-line bg-surface-sunk text-ink-soft hover:bg-surface-sunk/70',
              )}
              style={selected ? { borderColor: fg, backgroundColor: categoryTint(c.color, '26') } : undefined}
            >
              <CategoryGlyph icon={c.icon} color={c.isActive ? fg : undefined} size={14} />
              {c.name}
              {!c.isActive ? ' · Archived' : ''}
            </button>
          );
        })}
      </div>
      {canManage ? (
        <Link href={manageHref} className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold text-accent hover:underline">
          Customize categories
        </Link>
      ) : null}
    </div>
  );
}
