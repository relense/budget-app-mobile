import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { graphqlRequest } from './graphqlClient';
import type { BudgetType } from './types';

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

export interface CreateCategoryWithBudgetInput {
  name: string;
  icon: string;
  color: string;
  budgetType: BudgetType;
  month: string;
  monthlyBudgetCents: number;
}

// Plain, React-free function (accessToken passed explicitly, same reasoning as graphqlClient.ts)
// so the actual create-then-activate sequencing is unit-testable without react-query --
// renderHook hangs when combined with react-query state in this environment (see
// docs/PROGRESS-MOBILE.md), so hook-level behavior is only ever exercised through a full
// screen render() test with this function's *hook* wrapper mocked at the module level.
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

  await graphqlRequest(baseUrl, accessToken, ADD_CATEGORY_TO_MONTH_MUTATION, {
    categoryId: createCategory.id,
    month: input.month,
    monthlyBudgetCents: input.monthlyBudgetCents,
  });
}

export function useCreateCategoryWithBudget() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryWithBudgetInput) =>
      createCategoryWithBudget(getApiUrl(), accessToken as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}
