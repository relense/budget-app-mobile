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

// graphql-request throws a ClientError shaped like { response: { errors: [...] } } for a
// GraphQL-level error. The API maps every auth failure to extensions.code: 'UNAUTHENTICATED'
// (see docs/SERVICES.md) -- this is how AuthContext's requestWithAuth tells "the access token
// expired, refresh and retry" apart from every other kind of failure.
export function isUnauthenticatedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const response = (err as { response?: { errors?: { extensions?: { code?: string } }[] } })
    .response;
  return response?.errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED') ?? false;
}
