import { filterUnusedCategories, isDuplicateCategoryName } from '../../../src/lib/unusedCategories';
import type { Category, CategoryMonth } from '../../../src/api/types';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Shopping',
    icon: 'cart',
    color: '#D2FFD8',
    budgetType: 'NEED',
    direction: 'EXPENSE',
    ...overrides,
  };
}

function categoryMonth(overrides: Partial<CategoryMonth> = {}): CategoryMonth {
  return {
    id: 'cm1',
    month: '2026-09',
    monthlyBudgetCents: 0,
    actualAmountCents: 0,
    recurringCommittedCents: 0,
    category: category(),
    transactions: [],
    ...overrides,
  };
}

describe('filterUnusedCategories', () => {
  it('excludes a category already active this month', () => {
    const shopping = category({ id: 'c1', name: 'Shopping' });
    const activeThisMonth = [categoryMonth({ category: shopping })];

    expect(filterUnusedCategories([shopping], activeThisMonth, 'EXPENSE')).toEqual([]);
  });

  it('includes a category not active this month', () => {
    const shopping = category({ id: 'c1', name: 'Shopping' });
    const gas = category({ id: 'c2', name: 'Gas' });

    expect(filterUnusedCategories([shopping, gas], [], 'EXPENSE')).toEqual([shopping, gas]);
  });

  it('excludes categories of the other direction', () => {
    const salary = category({ id: 'c3', name: 'Salary', direction: 'INCOME' });

    expect(filterUnusedCategories([salary], [], 'EXPENSE')).toEqual([]);
  });

  it('filters to INCOME when asked, excluding EXPENSE categories', () => {
    const salary = category({ id: 'c3', name: 'Salary', direction: 'INCOME', budgetType: null });
    const shopping = category({ id: 'c1', name: 'Shopping' });

    expect(filterUnusedCategories([salary, shopping], [], 'INCOME')).toEqual([salary]);
  });
});

describe('isDuplicateCategoryName', () => {
  it('matches an existing expense category name case-insensitively, trimmed', () => {
    const catalog = [category({ name: 'Groceries' })];

    expect(isDuplicateCategoryName(catalog, '  groceries  ', 'EXPENSE')).toBe(true);
  });

  it('returns false for a name that does not match any existing category', () => {
    const catalog = [category({ name: 'Groceries' })];

    expect(isDuplicateCategoryName(catalog, 'Gas', 'EXPENSE')).toBe(false);
  });

  it('ignores categories of the other direction when checking for duplicates', () => {
    const catalog = [category({ name: 'Salary', direction: 'INCOME', budgetType: null })];

    expect(isDuplicateCategoryName(catalog, 'Salary', 'EXPENSE')).toBe(false);
  });

  it('matches within INCOME when asked, ignoring an EXPENSE category of the same name', () => {
    const catalog = [
      category({ name: 'Bonus', direction: 'EXPENSE' }),
      category({ name: 'Salary', direction: 'INCOME', budgetType: null }),
    ];

    expect(isDuplicateCategoryName(catalog, 'Salary', 'INCOME')).toBe(true);
    expect(isDuplicateCategoryName(catalog, 'Bonus', 'INCOME')).toBe(false);
  });
});
