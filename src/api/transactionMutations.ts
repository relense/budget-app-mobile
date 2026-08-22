import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth, type RequestWithAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { graphqlRequest } from './graphqlClient';

const CREATE_TRANSACTION_MUTATION = `
  mutation CreateTransaction($input: TransactionInput!) {
    createTransaction(input: $input) {
      id
    }
  }
`;

const UPDATE_TRANSACTION_MUTATION = `
  mutation UpdateTransaction($id: ID!, $input: TransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      id
    }
  }
`;

const DELETE_TRANSACTION_MUTATION = `
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export interface CreateTransactionInput {
  categoryMonthId: string;
  amountCents: number;
  date: string;
  // Blank in the UI is sent as null, not "" -- the Expenses row falls back to the category
  // name only when merchant is genuinely absent (see ListRow usage in app/(app)/index.tsx).
  merchant: string | null;
}

// TransactionInput is a full replace, not a patch (same convention as CategoryInput, see
// docs/PLAN.md) -- categoryMonthId must be resent even when it's unchanged, since
// edit-transaction always sends the currently-selected category, changed or not.
export interface UpdateTransactionInput {
  transactionId: string;
  categoryMonthId: string;
  amountCents: number;
  date: string;
  merchant: string | null;
}

export interface DeleteTransactionInput {
  transactionId: string;
}

export async function createTransaction(
  baseUrl: string,
  accessToken: string,
  input: CreateTransactionInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, CREATE_TRANSACTION_MUTATION, {
    input: {
      categoryMonthId: input.categoryMonthId,
      amountCents: input.amountCents,
      date: input.date,
      merchant: input.merchant,
    },
  });
}

export async function updateTransaction(
  baseUrl: string,
  accessToken: string,
  input: UpdateTransactionInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, UPDATE_TRANSACTION_MUTATION, {
    id: input.transactionId,
    input: {
      categoryMonthId: input.categoryMonthId,
      amountCents: input.amountCents,
      date: input.date,
      merchant: input.merchant,
    },
  });
}

export async function deleteTransaction(
  baseUrl: string,
  accessToken: string,
  input: DeleteTransactionInput,
): Promise<void> {
  await graphqlRequest(baseUrl, accessToken, DELETE_TRANSACTION_MUTATION, {
    id: input.transactionId,
  });
}

// Plain, requestWithAuth-taking mutation functions -- see the comment above the queryFn
// helpers in budgetHomeQueries.ts for why (unit-testable without renderHook).
export function createTransactionMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: CreateTransactionInput) =>
    requestWithAuth((token) => createTransaction(getApiUrl(), token, input));
}

export function updateTransactionMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: UpdateTransactionInput) =>
    requestWithAuth((token) => updateTransaction(getApiUrl(), token, input));
}

export function deleteTransactionMutationFn(requestWithAuth: RequestWithAuth) {
  return (input: DeleteTransactionInput) =>
    requestWithAuth((token) => deleteTransaction(getApiUrl(), token, input));
}

// A new/changed/removed transaction changes what three different queries would return: the
// transactions list itself, the owning CategoryMonth's actualAmountCents (and therefore the
// Available tab's spent/budget numbers), and the bank balance (derived from every transaction
// since its checkpoint) -- so all three mutations below invalidate the same set.
export function useCreateTransaction() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransactionMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}

export function useUpdateTransaction() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransactionMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}

export function useDeleteTransaction() {
  const { requestWithAuth } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransactionMutationFn(requestWithAuth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}
