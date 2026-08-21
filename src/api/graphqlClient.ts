import { GraphQLClient } from 'graphql-request';

// Takes accessToken explicitly rather than reading it from AuthContext itself -- keeps this
// module plain and testable (no React dependency), and matches how every call site already
// has the token in hand via useAuth().
export async function graphqlRequest<TResult, TVariables extends object = Record<string, unknown>>(
  baseUrl: string,
  accessToken: string,
  query: string,
  variables?: TVariables,
): Promise<TResult> {
  const client = new GraphQLClient(`${baseUrl}/graphql`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return client.request<TResult>(query, variables);
}
