import type { QueryClient, QueryKey } from '@tanstack/react-query';

export function getUserScopedQueryKey(baseKey: QueryKey, userId: string): QueryKey {
  return [...baseKey, { userId }];
}

export async function clearSessionQueryCache(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}