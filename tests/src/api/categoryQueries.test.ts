import { categoriesQueryFn } from '../../../src/api/categoryQueries';
import { graphqlRequest } from '../../../src/api/graphqlClient';
import type { RequestWithAuth } from '../../../src/auth/AuthContext';

jest.mock('../../../src/api/graphqlClient');

const mockedGraphqlRequest = graphqlRequest as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('categoriesQueryFn', () => {
  it('routes the call through requestWithAuth and unwraps categories', async () => {
    mockedGraphqlRequest.mockResolvedValue({ categories: [{ id: 'c-1', name: 'Shopping' }] });
    const token = 'fake-access-token';
    const requestWithAuth: RequestWithAuth = jest.fn((request) => request(token));

    const result = await categoriesQueryFn(requestWithAuth)();

    expect(requestWithAuth).toHaveBeenCalledTimes(1);
    expect(mockedGraphqlRequest).toHaveBeenCalledWith(
      expect.any(String),
      token,
      expect.stringContaining('categories'),
    );
    expect(result).toEqual([{ id: 'c-1', name: 'Shopping' }]);
  });
});
