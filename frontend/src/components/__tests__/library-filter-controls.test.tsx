import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LibraryFilterControls,
  type LibraryFilterState
} from "@/src/components/library-filter-controls";

const DEFAULT_FILTERS: LibraryFilterState = {
  search: "",
  publisher: "",
  year: "",
  sort: "title",
  direction: "asc",
  assetTypes: []
};

describe("LibraryFilterControls", () => {
  it("emits changes for search and sort inputs", () => {
    const handleChange = vi.fn();
    const { getByPlaceholderText, getByLabelText } = render(
      <LibraryFilterControls value={DEFAULT_FILTERS} onChange={handleChange} />
    );

    fireEvent.change(getByPlaceholderText("Search ROMs or summaries"), {
      target: { value: "chrono" }
    });
    expect(handleChange).toHaveBeenCalledWith({ search: "chrono" });

    handleChange.mockClear();
    fireEvent.change(getByLabelText("Sort"), { target: { value: "releaseYear" } });
    expect(handleChange).toHaveBeenCalledWith({ sort: "releaseYear" });
  });

  it("can render without publisher and year fields", () => {
    const { queryByPlaceholderText } = render(
      <LibraryFilterControls
        value={DEFAULT_FILTERS}
        onChange={() => undefined}
        showPublisher={false}
        showYear={false}
      />
    );

    expect(queryByPlaceholderText("Nintendo, Capcom, Square…")).toBeNull();
    expect(queryByPlaceholderText("1994")).toBeNull();
  });
});
