import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/src/lib/api/admin/pixellab", () => ({
  listPixelLabRenders: vi.fn(),
  getPixelLabCache: vi.fn(),
  requestPixelLabRender: vi.fn(),
  regeneratePixelLabRender: vi.fn()
}));

vi.mock("@/src/lib/api/admin/screenscraper", () => ({
  getScreenScraperStatus: vi.fn(),
  getScreenScraperSettings: vi.fn()
}));

const { PixelLabDashboard } = await import("./PixelLabDashboard");
const pixelLabApi = await import("@/src/lib/api/admin/pixellab");
const screenScraperApi = await import("@/src/lib/api/admin/screenscraper");

const listPixelLabRenders = vi.mocked(pixelLabApi.listPixelLabRenders);
const getPixelLabCache = vi.mocked(pixelLabApi.getPixelLabCache);
const requestPixelLabRender = vi.mocked(pixelLabApi.requestPixelLabRender);
const regeneratePixelLabRender = vi.mocked(pixelLabApi.regeneratePixelLabRender);
const getScreenScraperStatus = vi.mocked(screenScraperApi.getScreenScraperStatus);
const getScreenScraperSettings = vi.mocked(screenScraperApi.getScreenScraperSettings);

describe("PixelLabDashboard", () => {
  beforeEach(() => {
    listPixelLabRenders.mockResolvedValue({
      renders: [
        {
          id: "render_1",
          cacheKey: "cache-key",
          prompt: "Render hero art",
          styleId: "style-1",
          cacheHit: false,
          createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
          rom: { id: "rom_1", title: "Test ROM" },
          romAsset: { id: "asset_1", type: "COVER" }
        }
      ]
    });

    getPixelLabCache.mockResolvedValue({
      summary: {
        entries: 1,
        hits: 3,
        misses: 2,
        hitRate: 0.6,
        staleEntries: 0,
        latestRenderAt: new Date("2025-01-01T00:00:00Z").toISOString()
      },
      entries: [
        {
          id: "cache_1",
          cacheKey: "cache-key",
          prompt: "Render hero art",
          styleId: "style-1",
          romId: "rom_1",
          romTitle: "Test ROM",
          romAssetId: "asset_1",
          assetType: "COVER",
          expiresAt: new Date("2025-02-01T00:00:00Z").toISOString(),
          updatedAt: new Date("2025-01-02T00:00:00Z").toISOString(),
          lastRequestedAt: new Date("2025-01-03T00:00:00Z").toISOString(),
          hitCount: 3,
          missCount: 2,
          width: 320,
          height: 180,
          mimeType: "image/png",
          fileSize: 2048
        }
      ]
    });

    getScreenScraperStatus.mockResolvedValue({
      enabled: true,
      diagnostics: { pingMs: 123 }
    });

    getScreenScraperSettings.mockResolvedValue({
      defaults: {
        languagePriority: ["en"],
        regionPriority: ["us"],
        mediaTypes: ["box"],
        onlyBetterMedia: true,
        maxAssetsPerType: 2,
        preferParentGames: true
      },
      user: null,
      effective: {
        languagePriority: ["en"],
        regionPriority: ["us"],
        mediaTypes: ["box"],
        onlyBetterMedia: true,
        maxAssetsPerType: 2,
        preferParentGames: true
      }
    });

    requestPixelLabRender.mockResolvedValue({ result: {} });
    regeneratePixelLabRender.mockResolvedValue({ result: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders cache stats and render history", async () => {
    render(<PixelLabDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/PixelLab Control Deck/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Cache Pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/Recent Renders/i)).toBeInTheDocument();
    expect(screen.getByText(/ScreenScraper Diagnostics/i)).toBeInTheDocument();
  });

  it("submits hero art request", async () => {
    render(<PixelLabDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Target ROM ID/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Target ROM ID/i), {
      target: { value: "rom_42" }
    });
    fireEvent.change(screen.getByLabelText(/Prompt/i), {
      target: { value: "Render a castle" }
    });

    fireEvent.click(screen.getByRole("button", { name: /Summon Hero Art/i }));

    await waitFor(() => {
      expect(requestPixelLabRender).toHaveBeenCalledWith({
        romId: "rom_42",
        prompt: "Render a castle",
        styleId: undefined
      });
    });
  });

  it("regenerates cached render", async () => {
    render(<PixelLabDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Cache Pulse/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Regenerate/i }));

    await waitFor(() => {
      expect(regeneratePixelLabRender).toHaveBeenCalledWith("cache-key");
    });
  });
});
