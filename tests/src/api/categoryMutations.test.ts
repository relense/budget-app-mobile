import {
  addCategoryToMonth,
  createCategoryWithBudget,
  removeCategoryFromMonth,
  updateCategory,
  updateCategoryMonthBudget,
} from '../../../src/api/categoryMutations';
import { graphqlRequest } from '../../../src/api/graphqlClient';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

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
