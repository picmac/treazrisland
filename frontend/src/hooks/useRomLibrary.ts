import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { ApiError, toggleRomFavorite } from '@/lib/apiClient';
import { listRoms, type RomListFilters } from '@/lib/roms';
import type { RomSummary } from '@/types/rom';

export type LibraryFilters = Omit<RomListFilters, 'favorites'> & {
  favoritesOnly?: boolean;
};

interface LibraryPageResult {
  items: RomSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const buildQueryKey = (filters: LibraryFilters) => [
  'roms',
  filters.platform ?? null,
  filters.genre ?? null,
  Boolean(filters.favoritesOnly),
  filters.order ?? 'recent',
];

export const useRomLibrary = (filters: LibraryFilters = {}) => {
  const queryClient = useQueryClient();
  const mergedFilters: RomListFilters = {
    pageSize: filters.pageSize ?? 24,
    platform: filters.platform,
    genre: filters.genre,
    favorites: filters.favoritesOnly,
    order: filters.order ?? 'recent',
  };

  const query = useInfiniteQuery<LibraryPageResult, ApiError>({
    queryKey: buildQueryKey(filters),
    queryFn: ({ pageParam = 1 }) => listRoms({ ...mergedFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.meta.page + 1;
      return nextPage <= lastPage.meta.totalPages ? nextPage : undefined;
    },
    retry: 1,
  });

  const toggleFavorite = useMutation({
    mutationFn: (romId: string) => toggleRomFavorite(romId),
    onSuccess: (result) => {
      queryClient.setQueriesData<InfiniteData<LibraryPageResult>>(
        { queryKey: ['roms'] },
        (previous) => {
          if (!previous) return previous;

          const pages = previous.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === result.romId ? { ...item, isFavorite: result.isFavorite } : item,
            ),
          }));

          return { ...previous, pages };
        },
      );

      queryClient.invalidateQueries({ queryKey: ['rom-detail', result.romId] }).catch(() => {
        // Best-effort cache refresh.
      });
    },
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    meta: query.data?.pages.at(-1)?.meta,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    toggleFavorite: toggleFavorite.mutateAsync,
    isFavoritePending: toggleFavorite.isPending,
  };
};
