import { GraphQLClient } from 'graphql-request';

import { graphqlRequest, isUnauthenticatedError } from '../../../src/api/graphqlClient';

jest.mock('graphql-request');

describe('graphqlRequest', () => {
  it('builds a client against /graphql with a bearer token and forwards the request', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ ping: 'pong' });
    (GraphQLClient as unknown as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const result = await graphqlRequest<{ ping: string }>(
      'http://localhost:4400',
      'token-1',
      'query { ping }',
      { foo: 'bar' },
    );

    expect(GraphQLClient).toHaveBeenCalledWith('http://localhost:4400/graphql', {
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(mockRequest).toHaveBeenCalledWith('query { ping }', { foo: 'bar' });
    expect(result).toEqual({ ping: 'pong' });
  });
});

describe('isUnauthenticatedError', () => {
  it('is true for a GraphQL error carrying the UNAUTHENTICATED code', () => {
    const err = { response: { errors: [{ message: 'nope', extensions: { code: 'UNAUTHENTICATED' } }] } };
    expect(isUnauthenticatedError(err)).toBe(true);
  });

  it('is false for a different GraphQL error code', () => {
    const err = {
      response: { errors: [{ message: 'nope', extensions: { code: 'CATEGORY_NOT_FOUND' } }] },
    };
    expect(isUnauthenticatedError(err)).toBe(false);
  });

  it('is false for a plain network error with no GraphQL response shape', () => {
    expect(isUnauthenticatedError(new Error('network error'))).toBe(false);
  });

  it('is false (not a throw) for a malformed response shape where errors is not an array', () => {
    expect(isUnauthenticatedError({ response: { errors: 'not-an-array' } })).toBe(false);
    expect(isUnauthenticatedError({ response: { errors: [null, 'nope', 42] } })).toBe(false);
  });

  it('is false for null/undefined/non-object input', () => {
    expect(isUnauthenticatedError(null)).toBe(false);
    expect(isUnauthenticatedError(undefined)).toBe(false);
    expect(isUnauthenticatedError('nope')).toBe(false);
  });
});
