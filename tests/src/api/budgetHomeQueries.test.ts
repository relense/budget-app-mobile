import {
  bankBalanceQueryFn,
  categoryMonthsQueryFn,
  currentMonthQueryFn,
  recurringExpensesQueryFn,
  transactionsQueryFn,
} from '../../../src/api/budgetHomeQueries';
import { graphqlRequest } from '../../../src/api/graphqlClient';
import type { RequestWithAuth } from '../../../src/auth/AuthContext';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

// Simulates AuthContext's real requestWithAuth on the success path: runs `request` with a
// known token and returns its result. Lets these tests verify each *QueryFn actually routes
// through requestWithAuth (asserting it was called, and with what token) instead of calling
// graphqlRequest directly -- the exact wiring a session-refresh regression could silently
// break, and which no screen test can catch since they all mock this whole module away.
function fakeRequestWithAuth(): { requestWithAuth: RequestWithAuth; token: string } {
  const token = 'fake-access-token';
  const requestWithAuth: RequestWithAuth = jest.fn((request) => request(token));
  return { requestWithAuth, token };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('currentMonthQueryFn', () => {
  it('routes the call through requestWithAuth and unwraps currentMonth', async () => {
    mockedGraphqlRequest.mockResolvedValue({ currentMonth: { month: '2026-09', locked: false } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    const result = await currentMonthQueryFn(requestWithAuth)();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('currentMonth'),
    );
    expect(result).toEqual({ month: '2026-09', locked: false });
  });
});

describe('categoryMonthsQueryFn', () => {
  it('routes the call through requestWithAuth with month/direction and unwraps categoryMonths', async () => {
    mockedGraphqlRequest.mockResolvedValue({ categoryMonths: [{ id: 'cm-1' }] });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    const result = await categoryMonthsQueryFn(requestWithAuth, '2026-09', 'EXPENSE')();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('categoryMonths'),
      { month: '2026-09', direction: 'EXPENSE' },
    );
    expect(result).toEqual([{ id: 'cm-1' }]);
  });
});

describe('recurringExpensesQueryFn', () => {
  it('routes the call through requestWithAuth and unwraps recurringExpenses', async () => {
    mockedGraphqlRequest.mockResolvedValue({ recurringExpenses: [{ id: 're-1' }] });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    const result = await recurringExpensesQueryFn(requestWithAuth, '2026-09')();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('recurringExpenses'),
      { month: '2026-09' },
    );
    expect(result).toEqual([{ id: 're-1' }]);
  });
});

describe('transactionsQueryFn', () => {
  it('routes the call through requestWithAuth and unwraps transactions', async () => {
    mockedGraphqlRequest.mockResolvedValue({ transactions: [{ id: 't-1' }] });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    const result = await transactionsQueryFn(requestWithAuth, '2026-09')();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('transactions'),
      { month: '2026-09' },
    );
    expect(result).toEqual([{ id: 't-1' }]);
  });
});

describe('bankBalanceQueryFn', () => {
  it('routes the call through requestWithAuth and unwraps bankBalance', async () => {
    mockedGraphqlRequest.mockResolvedValue({
      bankBalance: { amountCents: 1000, checkpointAmountCents: 0, checkpointSetAt: '2026-01-01T00:00:00.000Z' },
    });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    const result = await bankBalanceQueryFn(requestWithAuth)();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('bankBalance'),
    );
    expect(result).toEqual({
      amountCents: 1000,
      checkpointAmountCents: 0,
      checkpointSetAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
