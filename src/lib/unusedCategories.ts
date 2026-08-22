import type { Category, CategoryMonth, Direction } from '../api/types';

// Categories are month-independent and reusable across every month they're ever active in --
// this computes which categories of the given direction from the full catalog have NOT been
// activated (via addCategoryToMonth) for the given month yet, so "add category"/"add income"
// can offer reusing one of those instead of always creating a brand-new, potentially-duplicate
// catalog entry. Takes `direction` explicitly (was hardcoded to 'EXPENSE') so add-income.tsx
// can reuse this against income-direction categories too.
export function filterUnusedCategories(
  catalog: Category[],
  activeCategoryMonthsThisMonth: CategoryMonth[],
  direction: Direction,
): Category[] {
  const activeIds = new Set(activeCategoryMonthsThisMonth.map((cm) => cm.category.id));
  return catalog.filter((c) => c.direction === direction && !activeIds.has(c.id));
}

// Guards against creating a second category of the same direction with the same name
// (case/whitespace insensitive) as one that already exists in the catalog -- e.g. "Groceries"
// already exists but isn't active this month (so it'd show up via filterUnusedCategories above
// instead), and the user types "groceries" into the create-new form anyway. Takes `direction`
// explicitly (was hardcoded to 'EXPENSE') for the same reason as above.
export function isDuplicateCategoryName(
  catalog: Category[],
  name: string,
  direction: Direction,
): boolean {
  const normalized = name.trim().toLowerCase();
  return catalog.some(
    (c) => c.direction === direction && c.name.trim().toLowerCase() === normalized,
  );
}
