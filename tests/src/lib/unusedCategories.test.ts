import {
  filterUnusedExpenseCategories,
  isDuplicateCategoryName,
} from '../../../src/lib/unusedCategories';
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

describe('filterUnusedExpenseCategories', () => {
  it('excludes a category already active this month', () => {
    const shopping = category({ id: 'c1', name: 'Shopping' });
    const activeThisMonth = [categoryMonth({ category: shopping })];

    expect(filterUnusedExpenseCategories([shopping], activeThisMonth)).toEqual([]);
  });

  it('includes a category not active this month', () => {
    const shopping = category({ id: 'c1', name: 'Shopping' });
    const gas = category({ id: 'c2', name: 'Gas' });

    expect(filterUnusedExpenseCategories([shopping, gas], [])).toEqual([shopping, gas]);
  });

  it('excludes income-direction categories', () => {
    const salary = category({ id: 'c3', name: 'Salary', direction: 'INCOME' });

    expect(filterUnusedExpenseCategories([salary], [])).toEqual([]);
  });
});

describe('isDuplicateCategoryName', () => {
  it('matches an existing expense category name case-insensitively, trimmed', () => {
    const catalog = [category({ name: 'Groceries' })];

    expect(isDuplicateCategoryName(catalog, '  groceries  ')).toBe(true);
  });

  it('returns false for a name that does not match any existing category', () => {
    const catalog = [category({ name: 'Groceries' })];

    expect(isDuplicateCategoryName(catalog, 'Gas')).toBe(false);
  });

  it('ignores income-direction categories when checking for duplicates', () => {
    const catalog = [category({ name: 'Salary', direction: 'INCOME' })];

    expect(isDuplicateCategoryName(catalog, 'Salary')).toBe(false);
  });
});
