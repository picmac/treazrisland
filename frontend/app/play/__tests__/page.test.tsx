import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../getRomMetadata", () => ({
  getRomMetadata: vi.fn(),
}));

import { getRomMetadata } from "../getRomMetadata";
import PlayLandingPage from "../page";

describe("PlayLandingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the fallback when ROM metadata lookup fails", async () => {
    const romId = "rom-storm";
    vi.mocked(getRomMetadata).mockRejectedValueOnce(new Error("squall"));

    const ui = await PlayLandingPage({ searchParams: { romId } });
    render(ui);

    expect(
      screen.getByRole("heading", { name: /we couldn\'t load that rom just now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/rom scanner offline while loading/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute(
      "href",
      `/play?romId=${encodeURIComponent(romId)}`
    );
    expect(screen.getByRole("link", { name: /explore the library/i })).toBeInTheDocument();
  });
});
