import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from '../../../src/api/transactionMutations';
import { graphqlRequest } from '../../../src/api/graphqlClient';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

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
