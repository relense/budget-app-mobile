import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
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
// docs/PLAN.md) -- categoryMonthId must be resent even when only the amount/date/merchant
// changed, since edit-transaction doesn't offer changing the category itself.
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

// A new/changed/removed transaction changes what three different queries would return: the
// transactions list itself, the owning CategoryMonth's actualAmountCents (and therefore the
// Available tab's numbers, and the per-row cumulative-spend percent on the Expenses tab), and
// the bank balance (derived from every transaction since its checkpoint) -- so all three
// mutations below invalidate the same set.
export function useCreateTransaction() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      createTransaction(getApiUrl(), accessToken as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}

export function useUpdateTransaction() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) =>
      updateTransaction(getApiUrl(), accessToken as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}

export function useDeleteTransaction() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteTransactionInput) =>
      deleteTransaction(getApiUrl(), accessToken as string, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categoryMonths'] });
      queryClient.invalidateQueries({ queryKey: ['bankBalance'] });
    },
  });
}
