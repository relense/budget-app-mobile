import type { BudgetType, Category } from '../api/types';

// A recurring expense's own budgetType (RecurringExpenseInput requires one, independently of
// the category's own) is derived from the chosen category's own value rather than asking the
// user to pick it again on the Add/Edit Recurring Expense screens -- the category already
// carries a Need/Want/Savings designation, so asking twice was redundant. Savings is never
// valid for a recurring expense (backend rejects it, see docs/PLAN.md), so a Savings-budgeted
// category falls back to Need.
export function budgetTypeForCategory(
  category: Category | null,
): Extract<BudgetType, 'NEED' | 'WANT'> {
  return category?.budgetType === 'WANT' ? 'WANT' : 'NEED';
}
