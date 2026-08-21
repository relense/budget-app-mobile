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
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['currentMonth'],
    queryFn: () =>
      graphqlRequest<{ currentMonth: { month: string; locked: boolean } }>(
        getApiUrl(),
        accessToken as string,
        CURRENT_MONTH_QUERY,
      ).then((data) => data.currentMonth),
    enabled: !!accessToken,
  });
}

export function useCategoryMonths(month: string | undefined, direction: Direction) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['categoryMonths', month, direction],
    queryFn: () =>
      graphqlRequest<{ categoryMonths: CategoryMonth[] }>(
        getApiUrl(),
        accessToken as string,
        CATEGORY_MONTHS_QUERY,
        { month, direction },
      ).then((data) => data.categoryMonths),
    enabled: !!accessToken && !!month,
  });
}

export function useRecurringExpenses(month: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['recurringExpenses', month],
    queryFn: () =>
      graphqlRequest<{ recurringExpenses: RecurringExpense[] }>(
        getApiUrl(),
        accessToken as string,
        RECURRING_EXPENSES_QUERY,
        { month },
      ).then((data) => data.recurringExpenses),
    enabled: !!accessToken && !!month,
  });
}

export function useTransactions(month: string | undefined) {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['transactions', month],
    queryFn: () =>
      graphqlRequest<{ transactions: Transaction[] }>(
        getApiUrl(),
        accessToken as string,
        TRANSACTIONS_QUERY,
        { month },
      ).then((data) => data.transactions),
    enabled: !!accessToken && !!month,
  });
}

export function useBankBalance() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['bankBalance'],
    queryFn: () =>
      graphqlRequest<{ bankBalance: BankBalance }>(
        getApiUrl(),
        accessToken as string,
        BANK_BALANCE_QUERY,
      ).then((data) => data.bankBalance),
    enabled: !!accessToken,
  });
}
