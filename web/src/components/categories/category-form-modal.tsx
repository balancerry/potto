'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_IDS,
  CATEGORY_NAME_MAX_LENGTH,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  categoryColorHex,
  categoryTint,
} from '@/lib/core/logic/categories';
import type { PotCategory } from '@/lib/core/models';
import { CategoryGlyph } from '@/components/categories/category-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type CategoryFormValue = { name: string; icon: string; color: string };

/**
 * Modal to create or edit a category: name, icon (controlled catalog), color
 * (controlled palette). `onSubmit` resolves to an error message to show inline,
 * or undefined on success (the modal then closes). Mount it only while open
 * (keyed by category) so each open starts from that category's values.
 */
export function CategoryFormModal({
  category,
  onClose,
  onSubmit,
}: {
  category?: PotCategory;
  onClose: () => void;
  onSubmit: (value: CategoryFormValue) => Promise<string | undefined>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState<string>(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<string>(category?.color ?? DEFAULT_CATEGORY_COLOR);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await onSubmit({ name, icon, color });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  const fg = categoryColorHex(color);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-lg)] border border-line bg-surface p-5 shadow-lg sm:rounded-[var(--radius-lg)]"
      >
        <h2 id="category-form-title" className="font-sans text-lg font-semibold text-ink">
          {category ? 'Edit category' : 'Create category'}
        </h2>

        <div className="mt-4">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            ref={nameRef}
            value={name}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="e.g. Beach Activities"
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'category-error' : undefined}
          />
          {error ? (
            <p id="category-error" role="alert" className="mt-1.5 text-sm font-medium text-neg">
              {error}
            </p>
          ) : null}
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Icon</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_ICON_IDS.map((id) => {
              const selected = id === icon;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`Icon ${id}`}
                  aria-pressed={selected}
                  onClick={() => setIcon(id)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    selected ? '' : 'border-line bg-surface hover:bg-surface-sunk',
                  )}
                  style={selected ? { borderColor: fg, backgroundColor: categoryTint(color, '26') } : undefined}
                >
                  <CategoryGlyph icon={id} color={selected ? fg : undefined} size={18} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">Color</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => {
              const selected = c.id === color;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={selected}
                  onClick={() => setColor(c.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  style={{ borderColor: selected ? c.fg : 'transparent' }}
                >
                  <span className="h-6 w-6 rounded-full" style={{ backgroundColor: c.fg }} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </form>
    </div>
  );
}
