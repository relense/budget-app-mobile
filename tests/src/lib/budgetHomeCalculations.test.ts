import {
  mostRecentDate,
  sumActualCents,
  sumAvailableBudgetedCents,
  sumRecurringCents,
} from '../../../src/lib/budgetHomeCalculations';
import type { CategoryMonth, RecurringExpense } from '../../../src/api/types';

function categoryMonth(overrides: Partial<CategoryMonth> = {}): CategoryMonth {
  return {
    id: 'cm1',
    month: '2026-08',
    monthlyBudgetCents: 70000,
    actualAmountCents: 19420,
    recurringCommittedCents: 0,
    category: {
      id: 'c1',
      name: 'Shopping',
      icon: 'cart',
      color: '#4C6EF5',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    },
    transactions: [],
    ...overrides,
  };
}

function recurringExpense(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: 'r1',
    month: '2026-08',
    name: 'Water',
    amountCents: 2196,
    budgetType: 'NEED',
    dueDay: 10,
    dueDate: '2026-08-10',
    paidThisMonth: false,
    category: {
      id: 'c1',
      name: 'Shopping',
      icon: 'cart',
      color: '#4C6EF5',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    },
    transactions: [],
    ...overrides,
  };
}

describe('sumAvailableBudgetedCents', () => {
  it('sums budget minus actual across categories', () => {
    const cms = [
      categoryMonth({ monthlyBudgetCents: 70000, actualAmountCents: 19420 }),
      categoryMonth({ monthlyBudgetCents: 8000, actualAmountCents: 847 }),
    ];
    expect(sumAvailableBudgetedCents(cms)).toBe(70000 - 19420 + (8000 - 847));
  });

  it('returns 0 for an empty list', () => {
    expect(sumAvailableBudgetedCents([])).toBe(0);
  });
});

describe('sumActualCents', () => {
  it('sums actualAmountCents across categories', () => {
    const cms = [
      categoryMonth({ actualAmountCents: 19420 }),
      categoryMonth({ actualAmountCents: 847 }),
    ];
    expect(sumActualCents(cms)).toBe(19420 + 847);
  });
});

describe('sumRecurringCents', () => {
  it('sums amountCents regardless of paid status', () => {
    const res = [
      recurringExpense({ amountCents: 2196, paidThisMonth: false }),
      recurringExpense({ amountCents: 41600, paidThisMonth: true }),
    ];
    expect(sumRecurringCents(res)).toBe(2196 + 41600);
  });
});

describe('mostRecentDate', () => {
  it('returns the latest date string', () => {
    expect(
      mostRecentDate([
        { id: 't1', date: '2026-08-01' },
        { id: 't2', date: '2026-08-15' },
        { id: 't3', date: '2026-08-03' },
      ]),
    ).toBe('2026-08-15');
  });

  it('returns null for an empty list', () => {
    expect(mostRecentDate([])).toBeNull();
  });
});
