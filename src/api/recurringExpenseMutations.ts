import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth, type RequestWithAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { deleteTransaction } from './transactionMutations';
import { graphqlRequest } from './graphqlClient';
import type { BudgetType } from './types';

const CREATE_RECURRING_EXPENSE_MUTATION = `
  mutation CreateRecurringExpense(
    $input: RecurringExpenseInput!
    $month: String!
    $categoryMonthlyBudgetCents: Int
  ) {
    createRecurringExpense(
      input: $input
      month: $month
      categoryMonthlyBudgetCents: $categoryMonthlyBudgetCents
    ) {
      id
    }
  }
`;

const UPDATE_RECURRING_EXPENSE_MUTATION = `
  mutation UpdateRecurringExpense($id: ID!, $input: RecurringExpenseInput!) {
    updateRecurringExpense(id: $id, input: $input) {
      id
    }
  }
`;

const REMOVE_RECURRING_EXPENSE_FROM_MONTH_MUTATION = `
  mutation RemoveRecurringExpenseFromMonth($id: ID!) {
    removeRecurringExpenseFromMonth(id: $id)
  }
`;

const MARK_RECURRING_PAID_MUTATION = `
  mutation MarkRecurringPaid($id: ID!, $input: MarkRecurringPaidInput!) {
    markRecurringPaid(id: $id, input: $input) {
      id
    }
  }
`;

export interface CreateRecurringExpenseInput {
  name: string;
  amountCents: number;
  categoryId: string;
  budgetType: BudgetType;
  dueDay: number;
  month: string;
  // Only required server-side when the chosen category has never had a budget anywhere
  // (see docs/SERVICES.md's createRecurringExpense note) -- this screen doesn't collect one,
  // so that edge case surfaces as a plain mutation error rather than extra UI.
  categoryMonthlyBudgetCents?: number;
}

// RecurringExpenseInput is a full replace, not a patch (same convention as
// CategoryInput/TransactionInput, see docs/PLAN.md) -- every field must be resent even when
// only one actually changed.
export interface UpdateRecurringExpenseInput {
  recurringExpenseId: string;
  name: string;
  amountCents: number;
  categoryId: string;
  budgetType: BudgetType;
  dueDay: number;
}

export interface RemoveRecurringExpenseFromMonthInput {
  recurringExpenseId: string;
}

export interface MarkRecurringPaidInput {
  recurringExpenseId: string;
  amountCents: number;
  date: string;
}

// Plain, React-free functions (accessToken passed explicitly) -- same reasoning as
// transactionMutations.ts/categoryMutations.ts.
export async function createRecurringExpense(
  baseUrl: string,
  accessToken: string,
  input: CreateRecurringExpenseInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, CREATE_RECURRING_EXPENSE_MUTATION, {
    input: {
      name: input.name,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      budgetType: input.budgetType,
      dueDay: input.dueDay,
    },
    month: input.month,
    categoryMonthlyBudgetCents: input.categoryMonthlyBudgetCents,
  });
}

export async function updateRecurringExpense(
  baseUrl: string,
  accessToken: string,
  input: UpdateRecurringExpenseInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, UPDATE_RECURRING_EXPENSE_MUTATION, {
    id: input.recurringExpenseId,
    input: {
      name: input.name,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      budgetType: input.budgetType,
      dueDay: input.dueDay,
    },
  });
}

export async function removeRecurringExpenseFromMonth(
  baseUrl: string,
  accessToken: string,
  input: RemoveRecurringExpenseFromMonthInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, REMOVE_RECURRING_EXPENSE_FROM_MONTH_MUTATION, {
    id: input.recurringExpenseId,
  });
}

// merchant/note are always sent null -- this screen has no fields for them (the mockup only
// shows amount + date), unlike add/edit-transaction's own merchant field.
export async function markRecurringPaid(
  baseUrl: string,
  accessToken: string,
  input: MarkRecurringPaidInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, MARK_RECURRING_PAID_MUTATION, {
    id: input.recurringExpenseId,
    input: {
      amountCents: input.amountCents,
      date: input.date,
      merchant: null,
      note: null,
    },
  });
}

// There is no backend "unmark paid" mutation -- markRecurringPaid only ever creates a
// Transaction (see docs/SERVICES.md). Unmarking works by deleting every Transaction linked to
// this recurring expense this month, using the ids CATEGORY_MONTHS_QUERY/
// RECURRING_EXPENSES_QUERY now fetch. allSettled (not all) -- a partial failure (some deleted,
// some not) must still surface as an error to the caller (so it doesn't wrongly navigate away
// claiming success), but the ones that did succeed are real and shouldn't be hidden by the
// same failure.
export async function unmarkRecurringPaid(
  baseUrl: string,
  accessToken: string,
  transactionIds: string[],
): Promise<void> {
  const results = await Promise.allSettled(
    transactionIds.map((transactionId) =>
      deleteTransaction(baseUrl, accessToken, { transactionId }),
    ),
  );
  const failedCount = results.filter((r) => r.status === 'rejected').length;
  if (failedCount > 0) {
    throw new Error(
      `Failed to delete ${failedCount} of ${transactionIds.length} linked transactions`,
    );
  }
}

// Plain, requestWithAuth-taking mutation functions -- see the comment above the queryFn
// helpers in budgetHomeQueries.ts for why (unit-testable without renderHook).
export function createRecurringExpenseMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: CreateRecurringExpenseInput) =>
    requestWithAuth((token) => createRecurringExpense(getApiUrl(), token, input));
}

export function updateRecurringExpenseMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: UpdateRecurringExpenseInput) =>
    requestWithAuth((token) => updateRecurringExpense(getApiUrl(), token, input));
}

export function removeRecurringExpenseFromMonthMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: RemoveRecurringExpenseFromMonthInput) =>
    requestWithAuth((token) => removeRecurringExpenseFromMonth(getApiUrl(), token, input));
}

export function markRecurringPaidMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: MarkRecurringPaidInput) =>
    requestWithAuth((token) => markRecurringPaid(getApiUrl(), token, input));
}

export function unmarkRecurringPaidMutationFn(requestWithAuth: RequestWithAuth) {
  return (transactionIds: string[]) =>
    requestWithAuth((token) => unmarkRecurringPaid(getApiUrl(), token, transactionIds));
}

// A new/changed/removed recurring expense changes recurringExpenses itself and
// CategoryMonth.recurringCommittedCents (and can auto-activate a category this month) --
// invalidate both.
export function useCreateRecurringExpense() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRecurringExpenseMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}

export function useUpdateRecurringExpense() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRecurringExpenseMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}

export function useRemoveRecurringExpenseFromMonth() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeRecurringExpenseFromMonthMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
    },
  });
}

// Creates a Transaction under the hood (see docs/SERVICES.md) -- same invalidation set as
// useCreateTransaction, plus recurringExpenses itself (paidThisMonth changes).
export function useMarkRecurringPaid() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markRecurringPaidMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}

// Same invalidation set as useMarkRecurringPaid, since this undoes exactly what that created --
// deliberately using onSettled, not onSuccess: unmarkRecurringPaid throws on a partial failure
// (some transactions deleted, some not), but the ones that did succeed are real and every query
// this affects must still refetch to reflect that, not stay stale just because the whole batch
// wasn't clean. useDeleteTransaction's own per-call invalidation doesn't cover
// ['recurringExpenses'] (paidThisMonth), which is what this hook exists to fix -- a plain loop
// of useDeleteTransaction calls from the screen silently left the Recurrent tab showing "Paid"
// after unmarking, since nothing told that query to refetch.
export function useUnmarkRecurringPaid() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unmarkRecurringPaidMutationFn(requestWithAuth),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}
