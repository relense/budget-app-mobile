import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
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

// The full category catalog (month-independent) -- used to offer "add an existing category to
// this month" instead of always creating a new one, which would otherwise duplicate a category
// the user already has but simply hasn't activated for the current month yet.
export function useCategories() {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: ['categories'],
    queryFn: () =>
      graphqlRequest<{ categories: Category[] }>(
        getApiUrl(),
        accessToken as string,
        CATEGORIES_QUERY,
      ).then((data) => data.categories),
    enabled: !!accessToken,
  });
}
