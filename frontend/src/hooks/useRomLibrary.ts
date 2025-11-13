import useSWR from 'swr';

export interface RomEntry {
  id: string;
  title: string;
  platform: string;
  genre?: string;
  coverUrl?: string;
  publisher?: string;
  releaseYear?: number;
  rating?: number;
}

export interface RomLibraryFilters {
  search?: string;
  platform?: string;
  genre?: string;
  favoritesOnly?: boolean;
}

export interface RomLibraryMeta {
  total: number;
  filters: {
    platforms: string[];
    genres: string[];
  };
}

export interface RomLibraryResponse {
  roms: RomEntry[];
  meta: RomLibraryMeta;
}

const defaultFilters: RomLibraryFilters = {
  search: '',
  platform: 'all',
  genre: 'all',
  favoritesOnly: false
};

const defaultMeta: RomLibraryMeta = {
  total: 0,
  filters: {
    platforms: [],
    genres: []
  }
};

const serializeFilters = (filters: RomLibraryFilters): string => {
  const params = new URLSearchParams();

  if (filters.search && filters.search.trim().length > 0) {
    params.set('search', filters.search.trim());
  }

  if (filters.platform && filters.platform !== 'all') {
    params.set('platform', filters.platform);
  }

  if (filters.genre && filters.genre !== 'all') {
    params.set('genre', filters.genre);
  }

  if (filters.favoritesOnly) {
    params.set('favoritesOnly', 'true');
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
};

const fetcher = async (url: string): Promise<RomLibraryResponse> => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to load ROM library');
  }

  return (await response.json()) as RomLibraryResponse;
};

export const getRomLibraryFilterDefaults = (): RomLibraryFilters => ({
  ...defaultFilters
});

export function useRomLibrary(filters: RomLibraryFilters = defaultFilters) {
  const query = serializeFilters(filters);
  const key = `/api/library${query}`;

  const { data, error, isLoading, mutate } = useSWR<RomLibraryResponse>(
    key,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false
    }
  );

  return {
    roms: data?.roms ?? [],
    meta: data?.meta ?? defaultMeta,
    isLoading,
    isError: Boolean(error),
    error,
    mutate
  };
}
