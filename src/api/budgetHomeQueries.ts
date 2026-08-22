import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
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

export function useCurrentMonth() {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['currentMonth'],
    queryFn: () =>
      requestWithAuth((token) =>
        graphqlRequest<{ currentMonth: { month: string; locked: boolean } }>(
          getApiUrl(),
          token,
          CURRENT_MONTH_QUERY,
        ),
      ).then((data) => data.currentMonth),
    enabled: !!accessToken,
  });
}

export function useCategoryMonths(month: string | undefined, direction: Direction) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['categoryMonths', month, direction],
    queryFn: () =>
      requestWithAuth((token) =>
        graphqlRequest<{ categoryMonths: CategoryMonth[] }>(
          getApiUrl(),
          token,
          CATEGORY_MONTHS_QUERY,
          { month, direction },
        ),
      ).then((data) => data.categoryMonths),
    enabled: !!accessToken && !!month,
  });
}

export function useRecurringExpenses(month: string | undefined) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['recurringExpenses', month],
    queryFn: () =>
      requestWithAuth((token) =>
        graphqlRequest<{ recurringExpenses: RecurringExpense[] }>(
          getApiUrl(),
          token,
          RECURRING_EXPENSES_QUERY,
          { month },
        ),
      ).then((data) => data.recurringExpenses),
    enabled: !!accessToken && !!month,
  });
}

export function useTransactions(month: string | undefined) {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['transactions', month],
    queryFn: () =>
      requestWithAuth((token) =>
        graphqlRequest<{ transactions: Transaction[] }>(
          getApiUrl(),
          token,
          TRANSACTIONS_QUERY,
          { month },
        ),
      ).then((data) => data.transactions),
    enabled: !!accessToken && !!month,
  });
}

export function useBankBalance() {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['bankBalance'],
    queryFn: () =>
      requestWithAuth((token) =>
        graphqlRequest<{ bankBalance: BankBalance }>(getApiUrl(), token, BANK_BALANCE_QUERY),
      ).then((data) => data.bankBalance),
    enabled: !!accessToken,
  });
}
