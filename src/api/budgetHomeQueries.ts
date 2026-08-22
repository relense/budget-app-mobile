import { useQuery } from '@tanstack/react-query';

import { useAuth, type RequestWithAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { graphqlRequest } from './graphqlClient';
import type { BankBalance, CategoryMonth, Direction, RecurringExpense, Transaction } from './types';

const CURRENT_MONTH_QUERY = `
  query CurrentMonth {
    currentMonth {
      month
      locked
    }
  }
`;

const CATEGORY_MONTHS_QUERY = `
  query CategoryMonths($month: String!, $direction: Direction) {
    categoryMonths(month: $month, direction: $direction) {
      id
      month
      monthlyBudgetCents
      actualAmountCents
      recurringCommittedCents
      category {
        id
        name
        icon
        color
        budgetType
        direction
      }
      transactions {
        id
        date
      }
    }
  }
`;

const RECURRING_EXPENSES_QUERY = `
  query RecurringExpenses($month: String!) {
    recurringExpenses(month: $month) {
      id
      month
      name
      amountCents
      budgetType
      dueDay
      dueDate
      paidThisMonth
      category {
        id
        name
        icon
        color
        budgetType
        direction
      }
      transactions {
        id
        date
      }
    }
  }
`;

const TRANSACTIONS_QUERY = `
  query Transactions($month: String!) {
    transactions(month: $month) {
      id
      amountCents
      date
      merchant
      note
      direction
      recurringExpense {
        name
      }
      categoryMonth {
        id
        monthlyBudgetCents
        actualAmountCents
        category {
          id
          name
          icon
          color
          budgetType
          direction
        }
      }
    }
  }
`;

const BANK_BALANCE_QUERY = `
  query BankBalance {
    bankBalance {
      amountCents
      checkpointAmountCents
      checkpointSetAt
    }
  }
`;

// Plain, requestWithAuth-taking-as-a-parameter query functions (same reasoning as
// graphqlRequest taking accessToken explicitly, see graphqlClient.ts) -- lets a test verify
// each one actually routes through requestWithAuth (by passing a mock and asserting it was
// called) without needing renderHook + a real useQuery, which hangs in this environment (see
// docs/PROGRESS-MOBILE.md). Each hook below is just wiring: pass its own requestWithAuth in.
export function currentMonthQueryFn(requestWithAuth: RequestWithAuth) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ currentMonth: { month: string; locked: boolean } }>(
        getApiUrl(),
        token,
        CURRENT_MONTH_QUERY,
      ),
    ).then((data) => data.currentMonth);
}

export function categoryMonthsQueryFn(
  requestWithAuth: RequestWithAuth,
  month: string | undefined,
  direction: Direction,
) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ categoryMonths: CategoryMonth[] }>(
        getApiUrl(),
        token,
        CATEGORY_MONTHS_QUERY,
        { month, direction },
      ),
    ).then((data) => data.categoryMonths);
}

export function recurringExpensesQueryFn(requestWithAuth: RequestWithAuth, month: string | undefined) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ recurringExpenses: RecurringExpense[] }>(
        getApiUrl(),
        token,
        RECURRING_EXPENSES_QUERY,
        { month },
      ),
    ).then((data) => data.recurringExpenses);
}

export function transactionsQueryFn(requestWithAuth: RequestWithAuth, month: string | undefined) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ transactions: Transaction[] }>(getApiUrl(), token, TRANSACTIONS_QUERY, {
        month,
      }),
    ).then((data) => data.transactions);
}

export function bankBalanceQueryFn(requestWithAuth: RequestWithAuth) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ bankBalance: BankBalance }>(getApiUrl(), token, BANK_BALANCE_QUERY),
    ).then((data) => data.bankBalance);
}

export function useCurrentMonth() {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['currentMonth'],
    queryFn: currentMonthQueryFn(requestWithAuth),
    enabled: !!accessToken,
  });
}

export function useCategoryMonths(month: string | undefined, direction: Direction) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['categoryMonths', month, direction],
    queryFn: categoryMonthsQueryFn(requestWithAuth, month, direction),
    enabled: !!accessToken && !!month,
  });
}

export function useRecurringExpenses(month: string | undefined) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['recurringExpenses', month],
    queryFn: recurringExpensesQueryFn(requestWithAuth, month),
    enabled: !!accessToken && !!month,
  });
}

export function useTransactions(month: string | undefined) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['transactions', month],
    queryFn: transactionsQueryFn(requestWithAuth, month),
    enabled: !!accessToken && !!month,
  });
}

export function useBankBalance() {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['bankBalance'],
    queryFn: bankBalanceQueryFn(requestWithAuth),
    enabled: !!accessToken,
  });
}
