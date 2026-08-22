import {
  createTransaction,
  createTransactionMutationFn,
  deleteTransaction,
  deleteTransactionMutationFn,
  updateTransaction,
  updateTransactionMutationFn,
} from '../../../src/api/transactionMutations';
import { graphqlRequest } from '../../../src/api/graphqlClient';
import type { RequestWithAuth } from '../../../src/auth/AuthContext';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

// Simulates AuthContext's real requestWithAuth on the success path: runs `request` with a
// known token and returns its result. Lets these tests verify each *Mutation:Fn actually
// routes through requestWithAuth (asserting it was called, and with what token) instead of
// calling graphqlRequest/the plain function directly -- the exact wiring a session-refresh
// regression could silently break, and which no screen test can catch since they all mock
// this whole module away.
function fakeRequestWithAuth(): { requestWithAuth: RequestWithAuth; token: string } {
  const token = 'fake-access-token';
  const requestWithAuth: RequestWithAuth = jest.fn((request) => request(token));
  return { requestWithAuth, token };
}

describe('createTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a transaction against the given CategoryMonth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createTransaction: { id: 't-1' } });

    await createTransaction('http://api.test', 'token-1', {
      categoryMonthId: 'cm-1',
      amountCents: 968,
      date: '2026-09-02',
      merchant: 'Continente',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('createTransaction'),
      {
        input: {
          categoryMonthId: 'cm-1',
          amountCents: 968,
          date: '2026-09-02',
          merchant: 'Continente',
        },
      },
    );
  });

  it('sends a null merchant when none was entered', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createTransaction: { id: 't-1' } });

    await createTransaction('http://api.test', 'token-1', {
      categoryMonthId: 'cm-1',
      amountCents: 500,
      date: '2026-09-02',
      merchant: null,
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('createTransaction'),
      {
        input: {
          categoryMonthId: 'cm-1',
          amountCents: 500,
          date: '2026-09-02',
          merchant: null,
        },
      },
    );
  });
});

describe('updateTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an existing transaction with a full TransactionInput replace', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateTransaction: { id: 't-1' } });

    await updateTransaction('http://api.test', 'token-1', {
      transactionId: 't-1',
      categoryMonthId: 'cm-1',
      amountCents: 1200,
      date: '2026-09-03',
      merchant: 'Auchan',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('updateTransaction'),
      {
        id: 't-1',
        input: {
          categoryMonthId: 'cm-1',
          amountCents: 1200,
          date: '2026-09-03',
          merchant: 'Auchan',
        },
      },
    );
  });
});

describe('deleteTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes the transaction by id', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ deleteTransaction: true });

    await deleteTransaction('http://api.test', 'token-1', { transactionId: 't-1' });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('deleteTransaction'),
      { id: 't-1' },
    );
  });
});

describe('*MutationFn wiring (requestWithAuth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createTransactionMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createTransaction: { id: 't-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await createTransactionMutationFn(requestWithAuth)({
      categoryMonthId: 'cm-1',
      amountCents: 968,
      date: '2026-09-02',
      merchant: 'Continente',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('createTransaction'),
      expect.objectContaining({ input: expect.objectContaining({ categoryMonthId: 'cm-1' }) }),
    );
  });

  it('updateTransactionMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateTransaction: { id: 't-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await updateTransactionMutationFn(requestWithAuth)({
      transactionId: 't-1',
      categoryMonthId: 'cm-1',
      amountCents: 1200,
      date: '2026-09-03',
      merchant: 'Auchan',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('updateTransaction'),
      expect.objectContaining({ id: 't-1' }),
    );
  });

  it('deleteTransactionMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ deleteTransaction: true });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await deleteTransactionMutationFn(requestWithAuth)({ transactionId: 't-1' });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('deleteTransaction'),
      { id: 't-1' },
    );
  });
});
