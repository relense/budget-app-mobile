import type { CategoryMonth, RecurringExpense, TransactionDate } from '../api/types';

export function sumAvailableBudgetedCents(categoryMonths: CategoryMonth[]): number {
  return categoryMonths.reduce(
    (total, cm) => total + (cm.monthlyBudgetCents - cm.actualAmountCents),
    0,
  );
}

export function sumActualCents(categoryMonths: CategoryMonth[]): number {
  return categoryMonths.reduce((total, cm) => total + cm.actualAmountCents, 0);
}

export function sumRecurringCents(recurringExpenses: RecurringExpense[]): number {
  return recurringExpenses.reduce((total, re) => total + re.amountCents, 0);
}

// monthlyBudgetCents of 0 has nothing to compute a percentage against -- 0%, not NaN/Infinity.
export function percentSpent(actualAmountCents: number, monthlyBudgetCents: number): number {
  if (monthlyBudgetCents === 0) return 0;
  return Math.round((actualAmountCents / monthlyBudgetCents) * 100);
}

// Dates are bare YYYY-MM-DD strings (see CLAUDE.md's dates convention) -- lexicographic
// comparison is correct for finding the max without any date parsing.
export function mostRecentDate(transactions: TransactionDate[]): string | null {
  if (transactions.length === 0) return null;
  return transactions.reduce(
    (latest, t) => (t.date > latest ? t.date : latest),
    transactions[0].date,
  );
}
