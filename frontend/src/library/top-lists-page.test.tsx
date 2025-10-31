import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("@lib/api/topLists", () => ({
  listTopLists: vi.fn()
}));

const { listTopLists } = await import("@lib/api/topLists");
const { TopListsPage } = await import("./top-lists-page");

describe("TopListsPage", () => {
  beforeEach(() => {
    vi.mocked(listTopLists).mockReset();
  });

  it("renders a loading indicator while fetching", async () => {
    let resolveRequest: ((value: { topLists: unknown[] }) => void) | null = null;
    vi.mocked(listTopLists).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<TopListsPage />);

    expect(
      screen.getByText(/Charting curated waters… fetching top lists\./i)
    ).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.({ topLists: [] });
    });
  });

  it("surfaces an error state when the API rejects", async () => {
    vi.mocked(listTopLists).mockRejectedValueOnce(new Error("nope"));

    render(<TopListsPage />);

    await waitFor(() => {
      expect(screen.getByText(/nope/i)).toBeInTheDocument();
    });
  });

  it("shows the empty state when no lists are returned", async () => {
    vi.mocked(listTopLists).mockResolvedValueOnce({ topLists: [] });

    render(<TopListsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No curated top lists have been published yet\./i)
      ).toBeInTheDocument();
    });
  });
});
