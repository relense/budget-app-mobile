import type { Category, CategoryMonth } from '../api/types';

// Categories are month-independent and reusable across every month they're ever active in --
// this computes which EXPENSE categories from the full catalog have NOT been activated (via
// addCategoryToMonth) for the given month yet, so "add category" can offer reusing one of
// those instead of always creating a brand-new, potentially-duplicate catalog entry.
export function filterUnusedExpenseCategories(
  catalog: Category[],
  activeCategoryMonthsThisMonth: CategoryMonth[],
): Category[] {
  const activeIds = new Set(activeCategoryMonthsThisMonth.map((cm) => cm.category.id));
  return catalog.filter((c) => c.direction === 'EXPENSE' && !activeIds.has(c.id));
}

// Guards against creating a second EXPENSE category with the same name (case/whitespace
// insensitive) as one that already exists in the catalog -- e.g. "Groceries" already exists but
// isn't active this month (so it'd show up via filterUnusedExpenseCategories above instead),
// and the user types "groceries" into the create-new form anyway.
export function isDuplicateCategoryName(catalog: Category[], name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return catalog.some(
    (c) => c.direction === 'EXPENSE' && c.name.trim().toLowerCase() === normalized,
  );
}
