export type Direction = 'EXPENSE' | 'INCOME';
export type BudgetType = 'NEED' | 'WANT' | 'SAVINGS';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  budgetType: BudgetType | null;
  direction: Direction;
}

export interface TransactionDate {
  id: string;
  date: string;
}

export interface CategoryMonth {
  id: string;
  month: string;
  monthlyBudgetCents: number;
  actualAmountCents: number;
  recurringCommittedCents: number;
  category: Category;
  transactions: TransactionDate[];
}

export interface RecurringExpense {
  id: string;
  month: string;
  name: string;
  amountCents: number;
  budgetType: BudgetType;
  dueDay: number;
  category: Category;
  paidThisMonth: boolean;
  transactions: TransactionDate[];
}

export interface Transaction {
  id: string;
  amountCents: number;
  date: string;
  merchant: string | null;
  note: string | null;
  direction: Direction;
  categoryMonth: {
    id: string;
    monthlyBudgetCents: number;
    actualAmountCents: number;
    category: Category;
  };
}

export interface BankBalance {
  amountCents: number;
  checkpointAmountCents: number;
  checkpointSetAt: string;
}
