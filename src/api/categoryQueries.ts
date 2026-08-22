import { useQuery } from '@tanstack/react-query';

import { useAuth, type RequestWithAuth } from '../auth/AuthContext';
import { getApiUrl } from '../lib/apiUrl';
import { graphqlRequest } from './graphqlClient';
import type { Category } from './types';

const CATEGORIES_QUERY = `
  query Categories {
    categories {
      id
      name
      icon
      color
      budgetType
      direction
    }
  }
`;

// Plain, requestWithAuth-taking function -- see the comment above the queryFn helpers in
// budgetHomeQueries.ts for why (unit-testable without renderHook).
export function categoriesQueryFn(requestWithAuth: RequestWithAuth) {
  return () =>
    requestWithAuth((token) =>
      graphqlRequest<{ categories: Category[] }>(getApiUrl(), token, CATEGORIES_QUERY),
    ).then((data) => data.categories);
}

// The full category catalog (month-independent) -- used to offer "add an existing category to
// this month" instead of always creating a new one, which would otherwise duplicate a category
// the user already has but simply hasn't activated for the current month yet.
export function useCategories() {
  const { accessToken, requestWithAuth } = useAuth();

  return useQuery({
    queryKey: ['categories'],
    queryFn: categoriesQueryFn(requestWithAuth),
    enabled: !!accessToken,
  });
}
