import { budgetTypeForCategory } from '../../../src/lib/recurringBudgetType';
import type { Category } from '../../../src/api/types';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Shopping',
    icon: 'cart',
    color: '#CEF3C8',
    budgetType: 'NEED',
    direction: 'EXPENSE',
    ...overrides,
  };
}

describe('budgetTypeForCategory', () => {
  it('returns WANT when the category is budgeted as WANT', () => {
    expect(budgetTypeForCategory(category({ budgetType: 'WANT' }))).toBe('WANT');
  });

  it('returns NEED when the category is budgeted as NEED', () => {
    expect(budgetTypeForCategory(category({ budgetType: 'NEED' }))).toBe('NEED');
  });

  it('falls back to NEED when the category is budgeted as SAVINGS -- never valid for a recurring expense', () => {
    expect(budgetTypeForCategory(category({ budgetType: 'SAVINGS' }))).toBe('NEED');
  });

  it('falls back to NEED when the category has no budgetType', () => {
    expect(budgetTypeForCategory(category({ budgetType: null }))).toBe('NEED');
  });

  it('falls back to NEED when there is no category at all', () => {
    expect(budgetTypeForCategory(null)).toBe('NEED');
  });
});
