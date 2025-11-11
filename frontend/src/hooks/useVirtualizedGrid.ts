import { useMemo } from "react";

type UseVirtualizedGridResetKeyParams = {
  slug: string;
  filters: {
    search: string;
    publisher: string;
    year: string;
    sort: string;
    direction: string;
    assetTypes: string[];
  };
  favoritesOnly?: boolean;
};

export function useVirtualizedGridResetKey({
  slug,
  filters,
  favoritesOnly
}: UseVirtualizedGridResetKeyParams): string {
  return useMemo(() => {
    const parts: Array<string> = [
      slug,
      filters.search.trim().toLowerCase(),
      filters.publisher.trim().toLowerCase(),
      filters.year.trim(),
      filters.sort,
      filters.direction,
      filters.assetTypes.join(",").toLowerCase()
    ];
    if (typeof favoritesOnly === "boolean") {
      parts.push(favoritesOnly ? "favorites" : "all");
    }
    return parts.join("|");
  }, [
    favoritesOnly,
    filters.assetTypes,
    filters.direction,
    filters.publisher,
    filters.search,
    filters.sort,
    filters.year,
    slug
  ]);
}
