import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth, type RequestWithAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { graphqlRequest } from './graphqlClient';
import type { BudgetType, Direction } from './types';

const CREATE_CATEGORY_MUTATION = `
  mutation CreateCategory($input: CategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

const ADD_CATEGORY_TO_MONTH_MUTATION = `
  mutation AddCategoryToMonth($categoryId: ID!, $month: String!, $monthlyBudgetCents: Int) {
    addCategoryToMonth(categoryId: $categoryId, month: $month, monthlyBudgetCents: $monthlyBudgetCents) {
      id
    }
  }
`;

const UPDATE_CATEGORY_MONTH_BUDGET_MUTATION = `
  mutation UpdateCategoryMonthBudget($categoryMonthId: ID!, $monthlyBudgetCents: Int!) {
    updateCategoryMonthBudget(categoryMonthId: $categoryMonthId, monthlyBudgetCents: $monthlyBudgetCents) {
      id
    }
  }
`;

const UPDATE_CATEGORY_MUTATION = `
  mutation UpdateCategory($id: ID!, $input: CategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
    }
  }
`;

const REMOVE_CATEGORY_FROM_MONTH_MUTATION = `
  mutation RemoveCategoryFromMonth($categoryMonthId: ID!) {
    removeCategoryFromMonth(categoryMonthId: $categoryMonthId)
  }
`;

export interface CreateCategoryWithBudgetInput {
  name: string;
  icon: string;
  color: string;
  budgetType: BudgetType;
  month: string;
  monthlyBudgetCents: number;
}

export interface AddCategoryToMonthInput {
  categoryId: string;
  month: string;
  monthlyBudgetCents: number;
}

export interface UpdateCategoryMonthBudgetInput {
  categoryMonthId: string;
  monthlyBudgetCents: number;
}

// CategoryInput is a full replace, not a patch (see docs/PLAN.md) -- every field must be
// resent even when only the name is changing, so callers need the category's current
// icon/color/budgetType/direction on hand, not just its id and new name.
export interface UpdateCategoryInput {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  budgetType: BudgetType | null;
  direction: Direction;
}

export interface RemoveCategoryFromMonthInput {
  categoryMonthId: string;
}

// Plain, React-free functions (accessToken passed explicitly, same reasoning as
// graphqlClient.ts) so the actual mutation sequencing is unit-testable without react-query --
// renderHook hangs when combined with react-query state in this environment (see
// docs/PROGRESS-MOBILE.md), so hook-level behavior is only ever exercised through a full
// screen render() test with each function's *hook* wrapper mocked at the module level.
export async function addCategoryToMonth(
  baseUrl: string,
  accessToken: string,
  input: AddCategoryToMonthInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, ADD_CATEGORY_TO_MONTH_MUTATION, {
    categoryId: input.categoryId,
    month: input.month,
    monthlyBudgetCents: input.monthlyBudgetCents,
  });
}

export async function updateCategoryMonthBudget(
  baseUrl: string,
  accessToken: string,
  input: UpdateCategoryMonthBudgetInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, UPDATE_CATEGORY_MONTH_BUDGET_MUTATION, {
    categoryMonthId: input.categoryMonthId,
    monthlyBudgetCents: input.monthlyBudgetCents,
  });
}

export async function updateCategory(
  baseUrl: string,
  accessToken: string,
  input: UpdateCategoryInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, UPDATE_CATEGORY_MUTATION, {
    id: input.categoryId,
    input: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      budgetType: input.budgetType,
      direction: input.direction,
    },
  });
}

export async function removeCategoryFromMonth(
  baseUrl: string,
  accessToken: string,
  input: RemoveCategoryFromMonthInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, REMOVE_CATEGORY_FROM_MONTH_MUTATION, {
    categoryMonthId: input.categoryMonthId,
  });
}

export async function createCategoryWithBudget(
  baseUrl: string,
  accessToken: string,
  input: CreateCategoryWithBudgetInput,
): Promise<void> {
  const { createCategory } = await graphqlRequest<{ createCategory: { id: string } }>(
    baseUrl,
    accessToken,
    CREATE_CATEGORY_MUTATION,
    {
      input: {
        name: input.name,
        icon: input.icon,
        color: input.color,
        budgetType: input.budgetType,
        direction: 'EXPENSE',
      },
    },
  );

  await addCategoryToMonth(baseUrl, accessToken, {
    categoryId: createCategory.id,
    month: input.month,
    monthlyBudgetCents: input.monthlyBudgetCents,
  });
}

// Plain, requestWithAuth-taking mutation functions -- see the comment above the plain
// accessToken-taking functions (this file) / the queryFn helpers in budgetHomeQueries.ts for
// why (unit-testable without renderHook).
export function createCategoryWithBudgetMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: CreateCategoryWithBudgetInput) =>
    requestWithAuth((token) => createCategoryWithBudget(getApiUrl(), token, input));
}

export function addCategoryToMonthMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: AddCategoryToMonthInput) =>
    requestWithAuth((token) => addCategoryToMonth(getApiUrl(), token, input));
}

export function updateCategoryMonthBudgetMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: UpdateCategoryMonthBudgetInput) =>
    requestWithAuth((token) => updateCategoryMonthBudget(getApiUrl(), token, input));
}

export function updateCategoryMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: UpdateCategoryInput) =>
    requestWithAuth((token) => updateCategory(getApiUrl(), token, input));
}

export function removeCategoryFromMonthMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: RemoveCategoryFromMonthInput) =>
    requestWithAuth((token) => removeCategoryFromMonth(getApiUrl(), token, input));
}

export function useCreateCategoryWithBudget() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategoryWithBudgetMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      // This mutation also creates a brand-new catalog entry (unlike useAddCategoryToMonth
      // below, which only reactivates an existing one) -- the catalog itself changed, so the
      // next Add Category open needs a fresh categories list too.
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// For reactivating an existing catalog category into the current month, instead of always
// creating a new one -- see filterUnusedExpenseCategories.
export function useAddCategoryToMonth() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addCategoryToMonthMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}

// For editing an existing CategoryMonth's budget from the swipe-to-edit screen -- doesn't
// touch the Category catalog at all, so no ['categories'] invalidation needed.
export function useUpdateCategoryMonthBudget() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategoryMonthBudgetMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}

// Renaming from the swipe-to-edit screen -- this does change the catalog entry itself
// (Category.name), so ['categories'] needs invalidating too, unlike the budget-only mutation
// above.
export function useUpdateCategory() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategoryMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// Deleting from the swipe-to-edit screen's Delete button -- may also cascade-delete the
// underlying Category server-side (see docs/SERVICES.md), so both query keys are invalidated
// the same way useUpdateCategory's are.
export function useRemoveCategoryFromMonth() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeCategoryFromMonthMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
