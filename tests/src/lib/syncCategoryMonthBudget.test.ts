import { syncCategoryMonthBudget } from '../../../src/lib/syncCategoryMonthBudget';
import type { CategoryMonth } from '../../../src/api/types';

const shoppingCategory = {
  id: 'c-shopping',
  name: 'Shopping',
  icon: 'cart',
  color: '#4C6EF5',
  budgetType: 'NEED' as const,
  direction: 'EXPENSE' as const,
};

const shoppingCategoryMonth: CategoryMonth = {
  id: 'cm-shopping',
  month: '2026-09',
  monthlyBudgetCents: 70000,
  actualAmountCents: 0,
  recurringCommittedCents: 0,
  category: shoppingCategory,
  transactions: [],
};

describe('syncCategoryMonthBudget', () => {
  it('adds a positive delta onto the existing budget for the matching category', async () => {
    const updateBudget = jest.fn().mockResolvedValue(undefined);

    await syncCategoryMonthBudget([shoppingCategoryMonth], 'c-shopping', 5000, updateBudget);

    expect(updateBudget).toHaveBeenCalledWith({
      categoryMonthId: 'cm-shopping',
      monthlyBudgetCents: 75000,
    });
  });

  it('subtracts a negative delta from the existing budget', async () => {
    const updateBudget = jest.fn().mockResolvedValue(undefined);

    await syncCategoryMonthBudget([shoppingCategoryMonth], 'c-shopping', -5000, updateBudget);

    expect(updateBudget).toHaveBeenCalledWith({
      categoryMonthId: 'cm-shopping',
      monthlyBudgetCents: 65000,
    });
  });

  it('clamps the result at 0 instead of going negative', async () => {
    const updateBudget = jest.fn().mockResolvedValue(undefined);

    await syncCategoryMonthBudget([shoppingCategoryMonth], 'c-shopping', -999999, updateBudget);

    expect(updateBudget).toHaveBeenCalledWith({
      categoryMonthId: 'cm-shopping',
      monthlyBudgetCents: 0,
    });
  });

  it('no-ops without calling updateBudget when the category has no budget row this month', async () => {
    const updateBudget = jest.fn().mockResolvedValue(undefined);

    await syncCategoryMonthBudget([shoppingCategoryMonth], 'c-no-such-category', 5000, updateBudget);

    expect(updateBudget).not.toHaveBeenCalled();
  });

  it('no-ops when categoryMonths itself is undefined (query not loaded yet)', async () => {
    const updateBudget = jest.fn().mockResolvedValue(undefined);

    await syncCategoryMonthBudget(undefined, 'c-shopping', 5000, updateBudget);

    expect(updateBudget).not.toHaveBeenCalled();
  });

  it('swallows a failure from updateBudget instead of throwing -- the primary action already succeeded', async () => {
    const updateBudget = jest.fn().mockRejectedValue(new Error('network error'));

    await expect(
      syncCategoryMonthBudget([shoppingCategoryMonth], 'c-shopping', 5000, updateBudget),
    ).resolves.toBeUndefined();
  });
});
