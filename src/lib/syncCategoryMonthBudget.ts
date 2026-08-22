import type { CategoryMonth } from '../api/types';
import type { UpdateCategoryMonthBudgetInput } from '../api/categoryMutations';

// Best-effort follow-up: called after a recurring expense create/update/delete has already
// succeeded, to keep the category's own monthlyBudgetCents in sync with what's now committed
// via recurring bills for that category+month (a recurring expense's budget is still a budget
// for that category, per the user). Swallows its own errors -- the primary action already
// saved, so a failure here shouldn't be reported as if that had failed too; it's silently
// correctable later from Edit Category. No-ops if the category has no budget row for this
// month yet (a fresh activation) rather than guessing what its budget should have been. If the
// user has since manually edited that category's budget, this still just adds/subtracts the
// delta on top of whatever they set -- their manually-chosen value is never overwritten wholesale.
export async function syncCategoryMonthBudget(
  categoryMonths: CategoryMonth[] | undefined,
  categoryId: string,
  deltaCents: number,
  updateBudget: (input: UpdateCategoryMonthBudgetInput) => Promise<unknown>,
): Promise<void> {
  const categoryMonth = categoryMonths?.find((cm) => cm.category.id === categoryId);
  if (!categoryMonth) return;
  try {
    await updateBudget({
      categoryMonthId: categoryMonth.id,
      monthlyBudgetCents: Math.max(0, categoryMonth.monthlyBudgetCents + deltaCents),
    });
  } catch {
    // best-effort, see comment above
  }
}
