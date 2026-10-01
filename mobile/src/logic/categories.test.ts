import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  MAX_ACTIVE_CATEGORIES,
  categoriesForPicker,
  categoryFilterOptions,
  categoryLabel,
  countCategoryUsage,
  getActiveCategories,
  matchesCategoryFilter,
  moveCategory,
  resolveCategory,
  usageLabel,
  validateCategoryInput,
  validateExpenseCategory,
  validateRestoreCategory,
} from '@/logic/categories';
import { canManageCategories } from '@/logic/permissions';
import type { Member, PotCategory, Transaction } from '@/types/models';

const cat = (over: Partial<PotCategory> & Pick<PotCategory, 'id' | 'name'>): PotCategory => ({
  potId: 'goa',
  icon: 'tag',
  color: 'gray',
  isActive: true,
  isDefault: false,
  sortOrder: 0,
  ...over,
});

const goaCategories: PotCategory[] = [
  cat({ id: 'food', name: 'Food', sortOrder: 1, icon: 'utensils', color: 'orange' }),
  cat({ id: 'transport', name: 'Transport', sortOrder: 2 }),
  cat({ id: 'shopping', name: 'Shopping', sortOrder: 3, isActive: false }),
  cat({ id: 'other', name: 'Other', sortOrder: 4 }),
];

const expense = (id: string, categoryId?: string, type: Transaction['type'] = 'pool_expense'): Transaction => ({
  id,
  potId: 'goa',
  type,
  description: id,
  amount: 1000,
  date: '2026-09-28',
  createdAt: '2026-09-28T10:00:00.000Z',
  createdBy: 'm1',
  categoryId,
});

const member = (over: Partial<Member>): Member => ({
  id: 'm',
  name: 'M',
  role: 'member',
  accessLevel: 'member',
  status: 'active',
  joinedAt: '2026-01-01',
  ...over,
});

describe('validateCategoryInput (create / rename / icon / color)', () => {
  it('creates a category with a normalised name', () => {
    const r = validateCategoryInput({ name: '  Beach   Activities ', icon: 'sparkles', color: 'blue' }, goaCategories);
    expect(r).toEqual({ valid: true, value: { name: 'Beach Activities', icon: 'sparkles', color: 'blue' } });
  });

  it('requires a name', () => {
    const r = validateCategoryInput({ name: '   ', icon: 'tag', color: 'gray' }, goaCategories);
    expect(r.valid).toBe(false);
  });

  it('rejects duplicate names case-insensitively, archived ones included', () => {
    for (const name of ['Food', 'food', 'FOOD', '  fOoD ']) {
      expect(validateCategoryInput({ name, icon: 'tag', color: 'gray' }, goaCategories).valid).toBe(false);
    }
    const archived = validateCategoryInput({ name: 'shopping', icon: 'tag', color: 'gray' }, goaCategories);
    expect(archived).toMatchObject({ valid: false });
    expect((archived as { error: string }).error).toMatch(/Restore it/);
  });

  it('allows the same name in another pot (callers pass only that pot\'s categories)', () => {
    const mussoorie: PotCategory[] = [cat({ id: 'm-transport', potId: 'mussoorie', name: 'Transport' })];
    expect(validateCategoryInput({ name: 'Food', icon: 'utensils', color: 'orange' }, mussoorie).valid).toBe(true);
  });

  it('rename: ignores the category being edited but still blocks other names', () => {
    expect(validateCategoryInput({ name: 'FOOD', icon: 'utensils', color: 'orange' }, goaCategories, 'food').valid).toBe(true);
    expect(validateCategoryInput({ name: 'Transport', icon: 'utensils', color: 'orange' }, goaCategories, 'food').valid).toBe(false);
  });

  it('change icon / change color accept only the controlled catalog', () => {
    expect(validateCategoryInput({ name: 'Food', icon: 'coffee', color: 'teal' }, goaCategories, 'food').valid).toBe(true);
    expect(validateCategoryInput({ name: 'Food', icon: '<svg/>', color: 'teal' }, goaCategories, 'food').valid).toBe(false);
    expect(validateCategoryInput({ name: 'Food', icon: 'coffee', color: '#ff0000' }, goaCategories, 'food').valid).toBe(false);
  });

  it('enforces the active category limit on create, not on edit', () => {
    const full = Array.from({ length: MAX_ACTIVE_CATEGORIES }, (_, i) => cat({ id: `c${i}`, name: `Cat ${i}`, sortOrder: i }));
    expect(validateCategoryInput({ name: 'One more', icon: 'tag', color: 'gray' }, full).valid).toBe(false);
    expect(validateCategoryInput({ name: 'Renamed', icon: 'tag', color: 'gray' }, full, 'c0').valid).toBe(true);
    expect(validateRestoreCategory(full).valid).toBe(false);
    expect(validateRestoreCategory(goaCategories).valid).toBe(true);
  });

  it('archived categories do not count toward the limit', () => {
    const list = [
      ...Array.from({ length: MAX_ACTIVE_CATEGORIES - 1 }, (_, i) => cat({ id: `c${i}`, name: `Cat ${i}` })),
      cat({ id: 'old', name: 'Old', isActive: false }),
    ];
    expect(validateCategoryInput({ name: 'Fits', icon: 'tag', color: 'gray' }, list).valid).toBe(true);
  });
});

describe('ordering', () => {
  it('lists active categories by sort_order, archived excluded', () => {
    expect(getActiveCategories(goaCategories).map((c) => c.id)).toEqual(['food', 'transport', 'other']);
  });

  it('moves a category up and down among the active ones', () => {
    expect(moveCategory(goaCategories, 'other', -1)).toEqual(['food', 'other', 'transport']);
    expect(moveCategory(goaCategories, 'food', 1)).toEqual(['transport', 'food', 'other']);
  });

  it('ignores moves past the ends and unknown ids', () => {
    expect(moveCategory(goaCategories, 'food', -1)).toEqual(['food', 'transport', 'other']);
    expect(moveCategory(goaCategories, 'other', 1)).toEqual(['food', 'transport', 'other']);
    expect(moveCategory(goaCategories, 'shopping', -1)).toEqual(['food', 'transport', 'other']);
  });

  it('moving a category never touches transactions (pure ordering)', () => {
    const txs = [expense('e1', 'food')];
    const before = JSON.stringify(txs);
    moveCategory(goaCategories, 'food', 1);
    expect(JSON.stringify(txs)).toBe(before);
  });
});

describe('expense <-> category relationship', () => {
  it('an expense may have no category (Uncategorized) or an active one of the same pot', () => {
    expect(validateExpenseCategory({ potId: 'goa', categories: goaCategories }).valid).toBe(true);
    expect(validateExpenseCategory({ potId: 'goa', categoryId: 'food', categories: goaCategories }).valid).toBe(true);
  });

  it('rejects a category that belongs to another pot', () => {
    const mixed = [...goaCategories, cat({ id: 'mus-food', potId: 'mussoorie', name: 'Food' })];
    expect(validateExpenseCategory({ potId: 'goa', categoryId: 'mus-food', categories: mixed }).valid).toBe(false);
    expect(validateExpenseCategory({ potId: 'goa', categoryId: 'nope', categories: goaCategories }).valid).toBe(false);
  });

  it('an archived category is not selectable for a new expense', () => {
    expect(validateExpenseCategory({ potId: 'goa', categoryId: 'shopping', categories: goaCategories }).valid).toBe(false);
    expect(categoriesForPicker(goaCategories).map((c) => c.id)).toEqual(['food', 'transport', 'other']);
  });

  it('editing an expense keeps its archived category selectable as-is', () => {
    expect(
      validateExpenseCategory({ potId: 'goa', categoryId: 'shopping', currentCategoryId: 'shopping', categories: goaCategories }).valid,
    ).toBe(true);
    expect(categoriesForPicker(goaCategories, 'shopping').map((c) => c.id)).toEqual(['food', 'transport', 'other', 'shopping']);
    // ...but switching away and back to a different archived one is not allowed.
    expect(
      validateExpenseCategory({ potId: 'goa', categoryId: 'shopping', currentCategoryId: 'food', categories: goaCategories }).valid,
    ).toBe(false);
  });
});

describe('display of historical expenses', () => {
  it('renames flow through because the expense references the id', () => {
    const renamed = goaCategories.map((c) => (c.id === 'food' ? { ...c, name: 'Food & Dining' } : c));
    const tx = expense('e1', 'food');
    expect(resolveCategory(tx.categoryId, goaCategories).name).toBe('Food');
    expect(resolveCategory(tx.categoryId, renamed).name).toBe('Food & Dining');
  });

  it('shows an archived category with an indicator', () => {
    const d = resolveCategory('shopping', goaCategories);
    expect(d.archived).toBe(true);
    expect(categoryLabel(d)).toBe('Shopping · Archived');
  });

  it('missing or unknown ids render as Uncategorized and never throw', () => {
    expect(resolveCategory(undefined, goaCategories).name).toBe('Uncategorized');
    expect(resolveCategory('ghost', goaCategories).uncategorized).toBe(true);
  });
});

describe('usage + activity filter', () => {
  const txs = [
    expense('e1', 'food'),
    expense('e2', 'food', 'member_expense'),
    expense('e3', 'shopping'),
    expense('e4'),
    { ...expense('c1', 'food', 'contribution') },
  ];

  it('counts expenses only', () => {
    expect(countCategoryUsage(txs)).toEqual({ food: 2, shopping: 1 });
    expect(usageLabel(12)).toBe('Used by 12 expenses');
    expect(usageLabel(1)).toBe('Used by 1 expense');
    expect(usageLabel(0)).toBe('Not used yet');
  });

  it('filter options: active categories + archived ones still used by history', () => {
    expect(categoryFilterOptions(goaCategories, txs).map((c) => c.id)).toEqual(['food', 'transport', 'shopping', 'other']);
    expect(categoryFilterOptions(goaCategories, [expense('e1', 'food')]).map((c) => c.id)).toEqual(['food', 'transport', 'other']);
  });

  it('filters activity by category, by uncategorized, and passes everything for "all"', () => {
    expect(txs.filter((t) => matchesCategoryFilter(t, CATEGORY_FILTER_ALL)).length).toBe(5);
    expect(txs.filter((t) => matchesCategoryFilter(t, 'food')).map((t) => t.id)).toEqual(['e1', 'e2']);
    expect(txs.filter((t) => matchesCategoryFilter(t, 'shopping')).map((t) => t.id)).toEqual(['e3']);
    expect(txs.filter((t) => matchesCategoryFilter(t, CATEGORY_FILTER_NONE)).map((t) => t.id)).toEqual(['e4']);
  });
});

describe('permissions', () => {
  it('only owner/admin can manage categories', () => {
    expect(canManageCategories(member({ role: 'owner' }))).toBe(true);
    expect(canManageCategories(member({ role: 'admin' }))).toBe(true);
    expect(canManageCategories(member({ role: 'member' }))).toBe(false);
    expect(canManageCategories(member({ role: 'member', accessLevel: 'view_only' }))).toBe(false);
    expect(canManageCategories(member({ role: 'admin', status: 'inactive' }))).toBe(false);
    expect(canManageCategories(undefined)).toBe(false);
  });
});
