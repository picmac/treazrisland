import { useMemo } from "react";

type UseVirtualizedGridResetKeyParams = {
  slug: string;
  filters: {
    search: string;
    publisher: string;
    year: string;
    sort: string;
    direction: string;
  };
};

export function useVirtualizedGridResetKey({
  slug,
  filters
}: UseVirtualizedGridResetKeyParams): string {
  return useMemo(() => {
    const parts: Array<string> = [
      slug,
      filters.search.trim().toLowerCase(),
      filters.publisher.trim().toLowerCase(),
      filters.year.trim(),
      filters.sort,
      filters.direction
    ];
    return parts.join("|");
  }, [filters.direction, filters.publisher, filters.search, filters.sort, filters.year, slug]);
}
