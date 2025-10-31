import { act, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@lib/api/client";

vi.mock("@lib/api/collections", () => ({
  getCollection: vi.fn()
}));

const { getCollection } = await import("@lib/api/collections");
const { CollectionDetailPage } = await import("./collection-detail-page");

describe("CollectionDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getCollection).mockReset();
  });

  const baseCollection = {
    id: "collection_1",
    slug: "spotlight",
    title: "Spotlight",
    description: "Hand picked",
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: "user_1",
    roms: []
  };

  it("shows a loading message before the collection resolves", async () => {
    let resolveRequest: ((value: { collection: typeof baseCollection }) => void) | null = null;
    vi.mocked(getCollection).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    render(<CollectionDetailPage slug="spotlight" />);

    expect(screen.getByText(/Hoisting ROM crates…/i)).toBeInTheDocument();

    await act(async () => {
      resolveRequest?.({ collection: baseCollection });
    });
  });

  it("renders an empty table message when the collection has no ROMs", async () => {
    vi.mocked(getCollection).mockResolvedValueOnce({ collection: baseCollection });

    render(<CollectionDetailPage slug="spotlight" />);

    await waitFor(() => {
      expect(
        screen.getByText(/This collection is empty\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows an error banner on failure", async () => {
    vi.mocked(getCollection).mockRejectedValueOnce(new ApiError("Missing", 404));

    render(<CollectionDetailPage slug="missing" />);

    await waitFor(() => {
      expect(screen.getByText(/Collection not found/i)).toBeInTheDocument();
    });
  });
});
