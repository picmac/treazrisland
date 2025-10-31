import { act, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@lib/api/client";

vi.mock("@lib/api/topLists", () => ({
  getTopList: vi.fn()
}));

const { getTopList } = await import("@lib/api/topLists");
const { TopListDetailPage } = await import("./top-list-detail-page");

describe("TopListDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getTopList).mockReset();
  });

  const baseTopList = {
    id: "list_1",
    slug: "favorites",
    title: "Favorites",
    description: "Top picks",
    publishedAt: new Date("2024-01-02T00:00:00Z").toISOString(),
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: "user_1",
    entries: []
  };

  it("shows a loading indicator before data arrives", async () => {
    let resolveRequest: ((value: { topList: typeof baseTopList }) => void) | null = null;
    vi.mocked(getTopList).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<TopListDetailPage slug="favorites" />);

    expect(screen.getByText(/Mapping each treasure slot…/i)).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.({ topList: baseTopList });
    });
  });

  it("renders the empty state when no entries exist", async () => {
    vi.mocked(getTopList).mockResolvedValueOnce({ topList: baseTopList });

    render(<TopListDetailPage slug="favorites" />);

    await waitFor(() => {
      expect(
        screen.getByText(/No ROMs have been ranked in this list yet\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows an error when the API rejects", async () => {
    vi.mocked(getTopList).mockRejectedValueOnce(new ApiError("Not found", 404));

    render(<TopListDetailPage slug="missing" />);

    await waitFor(() => {
      expect(screen.getByText(/Top list not found/i)).toBeInTheDocument();
    });
  });
});
