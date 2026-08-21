import { GraphQLClient } from 'graphql-request';

import { graphqlRequest } from '../../../src/api/graphqlClient';

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
