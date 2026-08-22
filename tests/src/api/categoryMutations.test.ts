import {
  addCategoryToMonth,
  addCategoryToMonthMutationFn,
  createCategoryWithBudget,
  createCategoryWithBudgetMutationFn,
  createIncomeCategoryWithBudget,
  createIncomeCategoryWithBudgetMutationFn,
  removeCategoryFromMonth,
  removeCategoryFromMonthMutationFn,
  updateCategory,
  updateCategoryMonthBudget,
  updateCategoryMonthBudgetMutationFn,
  updateCategoryMutationFn,
} from '../../../src/api/categoryMutations';
import { graphqlRequest } from '../../../src/api/graphqlClient';
import type { RequestWithAuth } from '../../../src/auth/AuthContext';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

// Simulates AuthContext's real requestWithAuth on the success path: runs `request` with a
// known token and returns its result. Lets these tests verify each *MutationFn actually routes
// through requestWithAuth (asserting it was called, and with what token) instead of calling
// graphqlRequest/the plain function directly -- the exact wiring a session-refresh regression
// could silently break, and which no screen test can catch since they all mock this whole
// module away.
function fakeRequestWithAuth(): { requestWithAuth: RequestWithAuth; token: string } {
  const token = 'fake-access-token';
  const requestWithAuth: RequestWithAuth = jest.fn((request) => request(token));
  return { requestWithAuth, token };
}

describe('createCategoryWithBudget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the category, then activates it in the given month with the budget', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createCategory: { id: 'cat-1' } });
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });

    await createCategoryWithBudget('http://api.test', 'token-1', {
      name: 'Shopping',
      icon: 'cart',
      color: '#4CAF50',
      budgetType: 'NEED',
      month: '2026-09',
      monthlyBudgetCents: 70000,
    });

    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      1,
      'http://api.test',
      'token-1',
      expect.stringContaining('createCategory'),
      {
        input: {
          name: 'Shopping',
          icon: 'cart',
          color: '#4CAF50',
          budgetType: 'NEED',
          direction: 'EXPENSE',
        },
      },
    );
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      2,
      'http://api.test',
      'token-1',
      expect.stringContaining('addCategoryToMonth'),
      {
        categoryId: 'cat-1',
        month: '2026-09',
        monthlyBudgetCents: 70000,
      },
    );
  });

  it('never calls addCategoryToMonth if createCategory fails', async () => {
    mockedGraphqlRequest.mockRejectedValueOnce(new Error('network error'));

    await expect(
      createCategoryWithBudget('http://api.test', 'token-1', {
        name: 'Shopping',
        icon: 'cart',
        color: '#4CAF50',
        budgetType: 'NEED',
        month: '2026-09',
        monthlyBudgetCents: 70000,
      }),
    ).rejects.toThrow('network error');

    expect(mockedGraphqlRequest).toHaveBeenCalledTimes(1);
  });
});

describe('createIncomeCategoryWithBudget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an INCOME-direction category with no budgetType, then activates it in the given month', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createCategory: { id: 'cat-1' } });
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });

    await createIncomeCategoryWithBudget('http://api.test', 'token-1', {
      name: 'Obconnect',
      icon: 'briefcase',
      color: '#B8D8F0',
      month: '2026-09',
      monthlyBudgetCents: 430000,
    });

    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      1,
      'http://api.test',
      'token-1',
      expect.stringContaining('createCategory'),
      {
        input: {
          name: 'Obconnect',
          icon: 'briefcase',
          color: '#B8D8F0',
          budgetType: null,
          direction: 'INCOME',
        },
      },
    );
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      2,
      'http://api.test',
      'token-1',
      expect.stringContaining('addCategoryToMonth'),
      {
        categoryId: 'cat-1',
        month: '2026-09',
        monthlyBudgetCents: 430000,
      },
    );
  });

  it('never calls addCategoryToMonth if createCategory fails', async () => {
    mockedGraphqlRequest.mockRejectedValueOnce(new Error('network error'));

    await expect(
      createIncomeCategoryWithBudget('http://api.test', 'token-1', {
        name: 'Obconnect',
        icon: 'briefcase',
        color: '#B8D8F0',
        month: '2026-09',
        monthlyBudgetCents: 430000,
      }),
    ).rejects.toThrow('network error');

    expect(mockedGraphqlRequest).toHaveBeenCalledTimes(1);
  });
});

describe('addCategoryToMonth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('activates an existing category in the given month with the budget', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });

    await addCategoryToMonth('http://api.test', 'token-1', {
      categoryId: 'cat-1',
      month: '2026-09',
      monthlyBudgetCents: 5000,
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('addCategoryToMonth'),
      {
        categoryId: 'cat-1',
        month: '2026-09',
        monthlyBudgetCents: 5000,
      },
    );
  });
});

describe('updateCategoryMonthBudget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an existing CategoryMonth with the new budget', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateCategoryMonthBudget: { id: 'cm-1' } });

    await updateCategoryMonthBudget('http://api.test', 'token-1', {
      categoryMonthId: 'cm-1',
      monthlyBudgetCents: 12000,
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('updateCategoryMonthBudget'),
      {
        categoryMonthId: 'cm-1',
        monthlyBudgetCents: 12000,
      },
    );
  });
});

describe('updateCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends every CategoryInput field, not just the one that changed', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateCategory: { id: 'cat-1' } });

    await updateCategory('http://api.test', 'token-1', {
      categoryId: 'cat-1',
      name: 'Groceries',
      icon: 'cart',
      color: '#4CAF50',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('updateCategory'),
      {
        id: 'cat-1',
        input: {
          name: 'Groceries',
          icon: 'cart',
          color: '#4CAF50',
          budgetType: 'NEED',
          direction: 'EXPENSE',
        },
      },
    );
  });
});

describe('removeCategoryFromMonth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes the CategoryMonth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ removeCategoryFromMonth: true });

    await removeCategoryFromMonth('http://api.test', 'token-1', {
      categoryMonthId: 'cm-1',
    });

    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      'http://api.test',
      'token-1',
      expect.stringContaining('removeCategoryFromMonth'),
      {
        categoryMonthId: 'cm-1',
      },
    );
  });
});

describe('*MutationFn wiring (requestWithAuth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createCategoryWithBudgetMutationFn routes both calls through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createCategory: { id: 'cat-1' } });
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await createCategoryWithBudgetMutationFn(requestWithAuth)({
      name: 'Shopping',
      icon: 'cart',
      color: '#4CAF50',
      budgetType: 'NEED',
      month: '2026-09',
      monthlyBudgetCents: 70000,
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      token,
      expect.stringContaining('createCategory'),
      expect.anything(),
    );
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      token,
      expect.stringContaining('addCategoryToMonth'),
      expect.anything(),
    );
  });

  it('createIncomeCategoryWithBudgetMutationFn routes both calls through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ createCategory: { id: 'cat-1' } });
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await createIncomeCategoryWithBudgetMutationFn(requestWithAuth)({
      name: 'Obconnect',
      icon: 'briefcase',
      color: '#B8D8F0',
      month: '2026-09',
      monthlyBudgetCents: 430000,
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      token,
      expect.stringContaining('createCategory'),
      expect.objectContaining({ input: expect.objectContaining({ direction: 'INCOME' }) }),
    );
    expect(mockedGraphqlRequest).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      token,
      expect.stringContaining('addCategoryToMonth'),
      expect.anything(),
    );
  });

  it('addCategoryToMonthMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ addCategoryToMonth: { id: 'cm-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await addCategoryToMonthMutationFn(requestWithAuth)({
      categoryId: 'cat-1',
      month: '2026-09',
      monthlyBudgetCents: 5000,
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('addCategoryToMonth'),
      expect.objectContaining({ categoryId: 'cat-1' }),
    );
  });

  it('updateCategoryMonthBudgetMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateCategoryMonthBudget: { id: 'cm-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await updateCategoryMonthBudgetMutationFn(requestWithAuth)({
      categoryMonthId: 'cm-1',
      monthlyBudgetCents: 12000,
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('updateCategoryMonthBudget'),
      expect.objectContaining({ categoryMonthId: 'cm-1' }),
    );
  });

  it('updateCategoryMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ updateCategory: { id: 'cat-1' } });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await updateCategoryMutationFn(requestWithAuth)({
      categoryId: 'cat-1',
      name: 'Groceries',
      icon: 'cart',
      color: '#4CAF50',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('updateCategory'),
      expect.objectContaining({ id: 'cat-1' }),
    );
  });

  it('removeCategoryFromMonthMutationFn routes the call through requestWithAuth', async () => {
    mockedGraphqlRequest.mockResolvedValueOnce({ removeCategoryFromMonth: true });
    const { requestWithAuth, token } = fakeRequestWithAuth();

    await removeCategoryFromMonthMutationFn(requestWithAuth)({ categoryMonthId: 'cm-1' });

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('removeCategoryFromMonth'),
      { categoryMonthId: 'cm-1' },
    );
  });
});
