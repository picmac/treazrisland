import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryFilters } from "@components/library/LibraryFilters";
import { FavoriteToggle } from "@components/library/FavoriteToggle";
import type { LibraryFilterState } from "@/src/components/library-filter-controls";

describe("library filters", () => {
  const defaultFilters: LibraryFilterState = {
    search: "",
    publisher: "",
    year: "",
    sort: "title",
    direction: "asc",
    assetTypes: []
  };

  it("notifies parent when filters change", () => {
    const onFiltersChange = vi.fn();
    const onReset = vi.fn();
    const onIncludeEmptyChange = vi.fn();
    const onFavoritesOnlyChange = vi.fn();

    render(
      <LibraryFilters
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        onReset={onReset}
        includeEmpty={false}
        onIncludeEmptyChange={onIncludeEmptyChange}
        favoritesOnly={false}
        onFavoritesOnlyChange={onFavoritesOnlyChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Search ROMs or summaries/i), {
      target: { value: "chrono" }
    });
    expect(onFiltersChange).toHaveBeenCalledWith({ search: "chrono" });

    onFiltersChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Covers/i }));
    expect(onFiltersChange).toHaveBeenCalledWith({ assetTypes: ["COVER"] });

    onFiltersChange.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /All assets/i }));
    expect(onFiltersChange).toHaveBeenCalledWith({ assetTypes: [] });

    fireEvent.click(screen.getByLabelText(/Show empty platforms/i));
    expect(onIncludeEmptyChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByLabelText(/Favorites only/i));
    expect(onFavoritesOnlyChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(onReset).toHaveBeenCalled();
  });
});

describe("favorite toggle", () => {
  it("toggles favorites and updates labels", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <FavoriteToggle romId="rom-1" favorite={false} pending={false} onToggle={onToggle} />
    );

    const button = screen.getByRole("button", { name: /Favorite/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith("rom-1");

    rerender(<FavoriteToggle romId="rom-1" favorite pending={false} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: /Favorited/i })).toBeEnabled();

    rerender(<FavoriteToggle romId="rom-1" favorite pending onToggle={onToggle} />);
    const pendingButton = screen.getByRole("button", { name: /Saving…/i });
    expect(pendingButton).toBeDisabled();
  });
});
