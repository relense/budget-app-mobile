import {
  createRecurringExpense,
  createRecurringExpenseMutationFn,
  markRecurringPaid,
  markRecurringPaidMutationFn,
  removeRecurringExpenseFromMonth,
  removeRecurringExpenseFromMonthMutationFn,
  unmarkRecurringPaid,
  unmarkRecurringPaidMutationFn,
  updateRecurringExpense,
  updateRecurringExpenseMutationFn,
} from '../../../src/api/recurringExpenseMutations';
import { graphqlRequest } from '../../../src/api/graphqlClient';
import type { RequestWithAuth } from '../../../src/auth/AuthContext';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

// Same reasoning as transactionMutations.test.ts/budgetHomeQueries.test.ts's
// fakeRequestWithAuth -- lets these tests verify each *MutationFn actually routes through
// requestWithAuth instead of calling graphqlRequest directly.
function fakeRequestWithAuth(): { requestWithAuth: RequestWithAuth; token: string } {
  const token = 'fake-access-token';
  const requestWithAuth: RequestWithAuth = jest.fn((request) => request(token));
  return { requestWithAuth, token };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createRecurringExpense', () => {
  it('creates a recurring expense for the given month', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createRecurringExpense: { id: 're-1' } });

    await createRecurringExpense('http://api.test', 'token-1', {
      name: 'Water',
      amountCents: 2196,
      categoryId: 'c-1',
      budgetType: 'NEED',
      dueDay: 10,
      month: '2026-09',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('createRecurringExpense'),
      {
        input: {
          name: 'Water',
          amountCents: 2196,
          categoryId: 'c-1',
          budgetType: 'NEED',
          dueDay: 10,
        },
        month: '2026-09',
        categoryMonthlyBudgetCents: undefined,
      },
    );
  });

  it('passes categoryMonthlyBudgetCents through when given', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createRecurringExpense: { id: 're-1' } });

    await createRecurringExpense('http://api.test', 'token-1', {
      name: 'Rent',
      amountCents: 80000,
      categoryId: 'c-2',
      budgetType: 'NEED',
      dueDay: 1,
      month: '2026-09',
      categoryMonthlyBudgetCents: 80000,
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('createRecurringExpense'),
      expect.objectContaining({ categoryMonthlyBudgetCents: 80000 }),
    );
  });
});

describe('updateRecurringExpense', () => {
  it('updates an existing recurring expense with a full RecurringExpenseInput replace', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateRecurringExpense: { id: 're-1' } });

    await updateRecurringExpense('http://api.test', 'token-1', {
      recurringExpenseId: 're-1',
      name: 'Water',
      amountCents: 2500,
      categoryId: 'c-1',
      budgetType: 'WANT',
      dueDay: 12,
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('updateRecurringExpense'),
      {
        id: 're-1',
        input: {
          name: 'Water',
          amountCents: 2500,
          categoryId: 'c-1',
          budgetType: 'WANT',
          dueDay: 12,
        },
      },
    );
  });
});

describe('removeRecurringExpenseFromMonth', () => {
  it('removes the recurring expense by id', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ removeRecurringExpenseFromMonth: true });

    await removeRecurringExpenseFromMonth('http://api.test', 'token-1', {
      recurringExpenseId: 're-1',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('removeRecurringExpenseFromMonth'),
      { id: 're-1' },
    );
  });
});

describe('markRecurringPaid', () => {
  it('marks a recurring expense paid with the given amount/date', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ markRecurringPaid: { id: 't-1' } });

    await markRecurringPaid('http://api.test', 'token-1', {
      recurringExpenseId: 're-1',
      amountCents: 2196,
      date: '2026-09-10',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('markRecurringPaid'),
      {
        id: 're-1',
        input: {
          amountCents: 2196,
          date: '2026-09-10',
          merchant: null,
          note: null,
        },
      },
    );
  });
});

describe('unmarkRecurringPaid', () => {
  it('deletes every given transaction id', async () => {
    mockedGraphqlRequest.mockResolvedValue({ deleteTransaction: true });

    await unmarkRecurringPaid('http://api.test', 'token-1', ['t-1', 't-2']);

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('deleteTransaction'),
      { id: 't-1' },
    );
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('deleteTransaction'),
      { id: 't-2' },
    );
  });

  it('resolves cleanly with an empty list -- nothing to delete', async () => {
    await expect(unmarkRecurringPaid('http://api.test', 'token-1', [])).resolves.toBeUndefined();
    expect(mockedGraphqlRequest).not.toHaveBeenCalled();
  });

  it('throws (reporting how many failed) if even one delete fails, after still attempting every one', async () => {
    mockedGraphqlRequest
      .mockResolvedValueOnce({ deleteTransaction: true })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ deleteTransaction: true });

    await expect(
      unmarkRecurringPaid('http://api.test', 'token-1', ['t-1', 't-2', 't-3']),
    ).rejects.toThrow('Failed to delete 1 of 3 linked transactions');

    // allSettled, not all -- every call was still attempted despite the middle one failing.
    expect(mockedGraphqlRequest).toHaveBeenCalledTimes(3);
  });
});

describe('*MutationFn wiring (requestWithAuth)', () => {
  it('createRecurringExpenseMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createRecurringExpense: { id: 're-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await createRecurringExpenseMutationFn(requestWithAuth)({
      name: 'Water',
      amountCents: 2196,
      categoryId: 'c-1',
      budgetType: 'NEED',
      dueDay: 10,
      month: '2026-09',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('createRecurringExpense'),
      expect.objectContaining({ month: '2026-09' }),
    );
  });

  it('updateRecurringExpenseMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateRecurringExpense: { id: 're-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await updateRecurringExpenseMutationFn(requestWithAuth)({
      recurringExpenseId: 're-1',
      name: 'Water',
      amountCents: 2500,
      categoryId: 'c-1',
      budgetType: 'WANT',
      dueDay: 12,
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('updateRecurringExpense'),
      expect.objectContaining({ id: 're-1' }),
    );
  });

  it('removeRecurringExpenseFromMonthMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ removeRecurringExpenseFromMonth: true });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await removeRecurringExpenseFromMonthMutationFn(requestWithAuth)({
      recurringExpenseId: 're-1',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('removeRecurringExpenseFromMonth'),
      { id: 're-1' },
    );
  });

  it('markRecurringPaidMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ markRecurringPaid: { id: 't-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await markRecurringPaidMutationFn(requestWithAuth)({
      recurringExpenseId: 're-1',
      amountCents: 2196,
      date: '2026-09-10',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('markRecurringPaid'),
      expect.objectContaining({ id: 're-1' }),
    );
  });

  it('unmarkRecurringPaidMutationFn routes every delete through the same requestWithAuth call', async () => {
    mockedGraphqlRequest.mockResolvedValue({ deleteTransaction: true });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await unmarkRecurringPaidMutationFn(requestWithAuth)(['t-1', 't-2']);

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('deleteTransaction'),
      { id: 't-1' },
    );
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('deleteTransaction'),
      { id: 't-2' },
    );
  });
});
