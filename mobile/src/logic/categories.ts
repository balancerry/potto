import type { PotCategory, Transaction } from '@/types/models';

/**
 * Pot-specific expense categories — pure rules shared by web and mobile (this
 * file is mirrored byte-for-byte at web/src/lib/core/logic/categories.ts).
 *
 * Categories are classification only: nothing here reads or changes an amount,
 * payer, participant, split, pool balance or settlement. The database enforces
 * the same invariants (same-pot, active-on-select, no hard delete of used
 * categories, duplicate names); these helpers give clients the same answers
 * up front so the UI can explain instead of waiting for an error.
 */

/** Most active categories one Pot may have. Mirrors max_active_pot_categories() in SQL. */
export const MAX_ACTIVE_CATEGORIES = 30;
export const CATEGORY_NAME_MAX_LENGTH = 40;

export const UNCATEGORIZED_LABEL = 'Uncategorized';

/** Controlled Lucide icon catalog. Keep in sync with pot_categories_icon_check. */
export const CATEGORY_ICON_IDS = [
  'utensils',
  'car',
  'bed',
  'sparkles',
  'shopping-bag',
  'shopping-cart',
  'fuel',
  'ticket',
  'landmark',
  'heart',
  'music',
  'camera',
  'gift',
  'coffee',
  'wine',
  'plane',
  'map',
  'tag',
  'more-horizontal',
] as const;
export type CategoryIconId = (typeof CATEGORY_ICON_IDS)[number];

/**
 * Controlled palette. Keep ids in sync with pot_categories_color_check. `fg` is
 * the icon/indicator color; tinted backgrounds are derived with `categoryTint`
 * so they read in both light and dark themes.
 */
export const CATEGORY_COLORS = [
  { id: 'green', label: 'Green', fg: '#2E8B57' },
  { id: 'gold', label: 'Gold', fg: '#B8860B' },
  { id: 'blue', label: 'Blue', fg: '#3B6FD4' },
  { id: 'purple', label: 'Purple', fg: '#7B5CC4' },
  { id: 'orange', label: 'Orange', fg: '#D9731E' },
  { id: 'red', label: 'Red', fg: '#C94A4A' },
  { id: 'teal', label: 'Teal', fg: '#1F8A8A' },
  { id: 'gray', label: 'Gray', fg: '#6B7280' },
] as const;
export type CategoryColorId = (typeof CATEGORY_COLORS)[number]['id'];

export const DEFAULT_CATEGORY_ICON: CategoryIconId = 'tag';
export const DEFAULT_CATEGORY_COLOR: CategoryColorId = 'gray';

export function isCategoryIcon(value: string): value is CategoryIconId {
  return (CATEGORY_ICON_IDS as readonly string[]).includes(value);
}

export function isCategoryColor(value: string): value is CategoryColorId {
  return CATEGORY_COLORS.some((c) => c.id === value);
}

/** Foreground hex for a palette id; unknown ids fall back to gray. */
export function categoryColorHex(color: string): string {
  return (CATEGORY_COLORS.find((c) => c.id === color) ?? CATEGORY_COLORS[CATEGORY_COLORS.length - 1]).fg;
}

/** Subtle translucent background for an icon chip, derived from the foreground hex. */
export function categoryTint(color: string, alphaHex = '1F'): string {
  return `${categoryColorHex(color)}${alphaHex}`;
}

/** Trim and collapse inner whitespace, exactly as the database does. */
export function normalizeCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function nameKey(name: string): string {
  return normalizeCategoryName(name).toLowerCase();
}

/** Display order: the Pot's own sort_order, ties broken by name for stability. */
export function sortCategories(categories: PotCategory[]): PotCategory[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getActiveCategories(categories: PotCategory[]): PotCategory[] {
  return sortCategories(categories.filter((c) => c.isActive));
}

export function getArchivedCategories(categories: PotCategory[]): PotCategory[] {
  return sortCategories(categories.filter((c) => !c.isActive));
}

export function countActiveCategories(categories: PotCategory[]): number {
  return categories.filter((c) => c.isActive).length;
}

export function canAddActiveCategory(categories: PotCategory[]): boolean {
  return countActiveCategories(categories) < MAX_ACTIVE_CATEGORIES;
}

export type CategoryInput = { name: string; icon: string; color: string };
export type CategoryValidation = { valid: true; value: CategoryInput } | { valid: false; error: string };

/**
 * Validates a create/rename/restyle request against the Pot's existing
 * categories (archived ones included — their names stay reserved so a restore
 * can never collide). `excludeId` is the category being edited.
 */
export function validateCategoryInput(
  input: CategoryInput,
  categories: PotCategory[],
  excludeId?: string,
): CategoryValidation {
  const name = normalizeCategoryName(input.name);
  if (!name) return { valid: false, error: 'Enter a category name' };
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return { valid: false, error: `Category names can be at most ${CATEGORY_NAME_MAX_LENGTH} characters` };
  }
  if (!isCategoryIcon(input.icon)) return { valid: false, error: 'Choose a supported icon' };
  if (!isCategoryColor(input.color)) return { valid: false, error: 'Choose a supported color' };

  const clash = categories.find((c) => c.id !== excludeId && nameKey(c.name) === nameKey(name));
  if (clash) {
    return {
      valid: false,
      error: clash.isActive
        ? `This pot already has a category named "${clash.name}"`
        : `"${clash.name}" is archived. Restore it instead of creating a new one`,
    };
  }

  if (!excludeId && !canAddActiveCategory(categories)) {
    return { valid: false, error: `A pot can have at most ${MAX_ACTIVE_CATEGORIES} active categories` };
  }

  return { valid: true, value: { name, icon: input.icon, color: input.color } };
}

export function validateRestoreCategory(categories: PotCategory[]): { valid: boolean; error?: string } {
  if (!canAddActiveCategory(categories)) {
    return { valid: false, error: `A pot can have at most ${MAX_ACTIVE_CATEGORIES} active categories` };
  }
  return { valid: true };
}

/**
 * Whether `categoryId` may be saved on an expense in `potId`.
 *  - none is always fine (renders as Uncategorized)
 *  - it must exist and belong to the SAME pot
 *  - an archived category is only allowed when it is what the expense already
 *    has (`currentCategoryId`), so editing an old expense never forces a change
 */
export function validateExpenseCategory(args: {
  potId: string;
  categoryId?: string;
  categories: PotCategory[];
  currentCategoryId?: string;
}): { valid: boolean; error?: string } {
  const { potId, categoryId, categories, currentCategoryId } = args;
  if (!categoryId) return { valid: true };
  const category = categories.find((c) => c.id === categoryId);
  if (!category || category.potId !== potId) {
    return { valid: false, error: 'That category does not belong to this pot' };
  }
  if (!category.isActive && categoryId !== currentCategoryId) {
    return { valid: false, error: `"${category.name}" is archived. Choose an active category` };
  }
  return { valid: true };
}

/**
 * What the expense form's picker should offer: every active category, plus the
 * expense's current category when it has since been archived (so it still shows
 * as selected instead of silently disappearing).
 */
export function categoriesForPicker(categories: PotCategory[], currentCategoryId?: string): PotCategory[] {
  const active = getActiveCategories(categories);
  if (!currentCategoryId) return active;
  const current = categories.find((c) => c.id === currentCategoryId);
  if (current && !current.isActive) return [...active, current];
  return active;
}

export interface CategoryDisplay {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  archived: boolean;
  uncategorized: boolean;
}

const UNCATEGORIZED: CategoryDisplay = {
  id: null,
  name: UNCATEGORIZED_LABEL,
  icon: 'tag',
  color: 'gray',
  archived: false,
  uncategorized: true,
};

/** Resolve an id to what to show. Missing / unknown ids render as Uncategorized and never throw. */
export function resolveCategory(categoryId: string | undefined | null, categories: PotCategory[]): CategoryDisplay {
  if (!categoryId) return UNCATEGORIZED;
  const c = categories.find((x) => x.id === categoryId);
  if (!c) return UNCATEGORIZED;
  return { id: c.id, name: c.name, icon: c.icon, color: c.color, archived: !c.isActive, uncategorized: false };
}

/** "Food & Dining", or "Beach Activities · Archived". */
export function categoryLabel(display: CategoryDisplay): string {
  return display.archived ? `${display.name} · Archived` : display.name;
}

function isExpense(tx: Transaction): boolean {
  return tx.type === 'pool_expense' || tx.type === 'member_expense';
}

/** Expenses per category id. Contributions, transfers and settlements never count. */
export function countCategoryUsage(transactions: Transaction[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const tx of transactions) {
    if (!isExpense(tx) || !tx.categoryId) continue;
    usage[tx.categoryId] = (usage[tx.categoryId] ?? 0) + 1;
  }
  return usage;
}

/** "Used by 12 expenses". */
export function usageLabel(count: number): string {
  if (count === 0) return 'Not used yet';
  return `Used by ${count} ${count === 1 ? 'expense' : 'expenses'}`;
}

/**
 * Activity filter options: active categories, plus archived ones that
 * historical expenses still use (so old activity stays filterable).
 */
export function categoryFilterOptions(categories: PotCategory[], transactions: Transaction[]): PotCategory[] {
  const usage = countCategoryUsage(transactions);
  return sortCategories(categories.filter((c) => c.isActive || (usage[c.id] ?? 0) > 0));
}

export const CATEGORY_FILTER_ALL = 'all';
export const CATEGORY_FILTER_NONE = 'none';
/** 'all', 'none' (Uncategorized) or a category id. */
export type CategoryFilterValue = string;

/** `filter` is 'all', 'none' (Uncategorized), or a category id. */
export function matchesCategoryFilter(tx: Transaction, filter: string): boolean {
  if (!filter || filter === CATEGORY_FILTER_ALL) return true;
  if (!isExpense(tx)) return false;
  if (filter === CATEGORY_FILTER_NONE) return !tx.categoryId;
  return tx.categoryId === filter;
}

/**
 * New order of the ACTIVE categories after moving one by a step. Returns the
 * full ordered id list to persist, or the unchanged order when the move is out
 * of range. Archived categories are not part of manual ordering.
 */
export function moveCategory(categories: PotCategory[], categoryId: string, direction: -1 | 1): string[] {
  const ids = getActiveCategories(categories).map((c) => c.id);
  const from = ids.indexOf(categoryId);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= ids.length) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}
