import { act, render, screen, waitFor } from "@testing-library/react";

vi.mock("@lib/api/collections", () => ({
  listCollections: vi.fn()
}));

const { listCollections } = await import("@lib/api/collections");
const { CollectionsPage } = await import("./collections-page");

describe("CollectionsPage", () => {
  beforeEach(() => {
    vi.mocked(listCollections).mockReset();
  });

  it("shows a loading message while waiting for collections", async () => {
    let resolveRequest: ((value: { collections: unknown[] }) => void) | null = null;
    vi.mocked(listCollections).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<CollectionsPage />);

    expect(screen.getByText(/Sorting the vault… gathering collections\./i)).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.({ collections: [] });
    });
  });

  it("shows an error banner if the API fails", async () => {
    vi.mocked(listCollections).mockRejectedValueOnce(new Error("boom"));

    render(<CollectionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/boom/i)).toBeInTheDocument();
    });
  });

  it("renders an empty state when no collections exist", async () => {
    vi.mocked(listCollections).mockResolvedValueOnce({ collections: [] });

    render(<CollectionsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/No collections have been assembled yet\./i)
      ).toBeInTheDocument();
    });
  });
});
