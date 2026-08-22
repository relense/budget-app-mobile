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
// GraphQL-level error, with each error's extensions.code set to the service's error reason,
// upper-cased (e.g. `category_not_found` -> `CATEGORY_NOT_FOUND`, see docs/SERVICES.md).
export function hasGraphqlErrorCode(err: unknown, code: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const errors = (err as { response?: { errors?: unknown } }).response?.errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (error) =>
      !!error &&
      typeof error === 'object' &&
      (error as { extensions?: { code?: string } }).extensions?.code === code,
  );
}

// This is how AuthContext's requestWithAuth tells "the access token expired, refresh and
// retry" apart from every other kind of failure.
export function isUnauthenticatedError(err: unknown): boolean {
  return hasGraphqlErrorCode(err, 'UNAUTHENTICATED');
}
