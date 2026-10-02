'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  createCategory,
  reorderCategories,
  setCategoryActive,
  updateCategory,
} from '@/lib/actions/categories';
import {
  MAX_ACTIVE_CATEGORIES,
  canAddActiveCategory,
  getActiveCategories,
  getArchivedCategories,
  moveCategory,
  usageLabel,
} from '@/lib/core/logic/categories';
import type { PotCategory } from '@/lib/core/models';
import { CategoryIcon } from '@/components/categories/category-icon';
import { CategoryFormModal, type CategoryFormValue } from '@/components/categories/category-form-modal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

type MenuItem = { label: string; onSelect: () => void; destructive?: boolean };

/**
 * Lightweight category management: compact rows, a ⋮ menu per row (Edit, Move
 * up/down, Archive; Restore for archived ones). Read-only unless `canManage`.
 * Reordering is Move up / Move down — the project has no drag-and-drop library.
 */
export function CategoryManager({
  potId,
  categories,
  usage,
  canManage,
}: {
  potId: string;
  categories: PotCategory[];
  /** Expenses per category id. */
  usage: Record<string, number>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<{ category?: PotCategory } | null>(null);
  const [archiving, setArchiving] = useState<PotCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const active = getActiveCategories(categories);
  const archived = getArchivedCategories(categories);
  const atLimit = !canAddActiveCategory(categories);

  async function submitForm(value: CategoryFormValue): Promise<string | undefined> {
    const editing = form?.category;
    const result = editing ? await updateCategory(potId, editing.id, value) : await createCategory(potId, value);
    if (!result.ok) return result.error;
    toast.success(editing ? 'Category updated' : 'Category created');
    router.refresh();
    return undefined;
  }

  async function move(category: PotCategory, direction: -1 | 1) {
    setBusy(true);
    const result = await reorderCategories(potId, moveCategory(categories, category.id, direction));
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function setActive(category: PotCategory, next: boolean) {
    setBusy(true);
    const result = await setCategoryActive(potId, category.id, next);
    setBusy(false);
    setArchiving(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(next ? `“${category.name}” restored` : `“${category.name}” archived`);
    router.refresh();
  }

  function menuFor(category: PotCategory, index: number): MenuItem[] {
    const items: MenuItem[] = [{ label: 'Edit', onSelect: () => setForm({ category }) }];
    if (index > 0) items.push({ label: 'Move up', onSelect: () => void move(category, -1) });
    if (index < active.length - 1) items.push({ label: 'Move down', onSelect: () => void move(category, 1) });
    items.push({ label: 'Archive', destructive: true, onSelect: () => setArchiving(category) });
    return items;
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div>
          <Button onClick={() => setForm({})} disabled={atLimit}>
            <Plus size={16} aria-hidden /> Add category
          </Button>
          {atLimit ? (
            <p className="mt-2 text-xs text-ink-soft">
              A pot can have up to {MAX_ACTIVE_CATEGORIES} active categories. Archive one to add another.
            </p>
          ) : null}
        </div>
      ) : null}

      {active.length === 0 ? (
        <EmptyState
          title="No active categories"
          description={
            canManage ? 'Create a category to organize your Pot’s expenses.' : 'A pot admin can create categories.'
          }
          action={canManage ? <Button onClick={() => setForm({})}>+ Add category</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface" aria-busy={busy}>
          {active.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <CategoryIcon icon={c.icon} color={c.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink-soft">{usageLabel(usage[c.id] ?? 0)}</p>
              </div>
              {canManage ? <RowMenu label={`Options for ${c.name}`} items={menuFor(c, i)} /> : null}
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <section className="space-y-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Archived</h3>
            <p className="mt-1 text-xs text-ink-soft">Not offered for new expenses. Existing expenses keep them.</p>
          </div>
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="opacity-55">
                  <CategoryIcon icon={c.icon} color={c.color} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-soft">{c.name}</p>
                  <p className="text-xs text-ink-soft">{usageLabel(usage[c.id] ?? 0)}</p>
                </div>
                {canManage ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void setActive(c, true)}>
                    Restore
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {form ? (
        <CategoryFormModal
          key={form.category?.id ?? 'new'}
          category={form.category}
          onClose={() => setForm(null)}
          onSubmit={submitForm}
        />
      ) : null}

      {archiving ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" onMouseDown={() => setArchiving(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-lg"
          >
            <h2 id="archive-title" className="font-sans text-lg font-semibold text-ink">
              Archive “{archiving.name}”?
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Existing expenses using this category will remain unchanged. The category will no longer appear when adding
              new expenses.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setArchiving(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void setActive(archiving, false)}>
                Archive category
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-soft hover:bg-surface-sunk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <MoreVertical size={18} aria-hidden />
      </button>
      {open ? (
        <ul role="menu" className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-lg">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-sunk focus-visible:bg-surface-sunk focus-visible:outline-none ${
                  item.destructive ? 'text-neg' : 'text-ink'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
