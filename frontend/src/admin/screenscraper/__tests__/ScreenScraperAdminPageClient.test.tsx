import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ScreenScraperAdminPageClient } from "../ScreenScraperAdminPageClient";
import {
  enqueueScreenScraperEnrichment,
  getScreenScraperSettings,
  getScreenScraperStatus,
  updateScreenScraperSettings,
} from "@/src/lib/api/admin/screenscraper";
import { ApiError } from "@/src/lib/api/client";

vi.mock("@/src/lib/api/admin/screenscraper", () => ({
  enqueueScreenScraperEnrichment: vi.fn(),
  getScreenScraperSettings: vi.fn(),
  getScreenScraperStatus: vi.fn(),
  updateScreenScraperSettings: vi.fn(),
}));

describe("ScreenScraperAdminPageClient", () => {
  beforeEach(() => {
    vi.mocked(updateScreenScraperSettings).mockReset();
    vi.mocked(getScreenScraperSettings).mockReset();
    vi.mocked(getScreenScraperStatus).mockReset();
    vi.mocked(enqueueScreenScraperEnrichment).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const baseSettings = {
    defaults: {
      languagePriority: ["en"],
      regionPriority: ["us"],
      mediaTypes: ["mix"],
      onlyBetterMedia: true,
      maxAssetsPerType: 2,
      preferParentGames: false,
    },
    user: null,
    effective: {
      languagePriority: ["en", "fr"],
      regionPriority: ["us", "eu"],
      mediaTypes: ["mix", "wheel"],
      onlyBetterMedia: true,
      maxAssetsPerType: 3,
      preferParentGames: false,
    },
  } as const;

  const baseStatus = {
    enabled: true,
    diagnostics: {
      rateLimit: { remaining: 42, reset: 12345 },
      warning: "Close to hourly quota",
    },
  } as const;

  it("renders service health, diagnostics, and defaults", () => {
    render(
      <ScreenScraperAdminPageClient
        initialStatus={baseStatus}
        initialSettings={baseSettings}
        initialError={null}
      />,
    );

    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByText("rateLimit")).toBeInTheDocument();
    expect(screen.getByText(/Close to hourly quota/)).toBeInTheDocument();
    expect(screen.getByText("Effective Defaults")).toBeInTheDocument();
    expect(screen.getByText("View system defaults")).toBeInTheDocument();
  });

  it("submits preference overrides and refreshes from the API", async () => {
    const user = userEvent.setup();

    vi.mocked(updateScreenScraperSettings).mockResolvedValue({ settings: {
      languagePriority: ["en"],
      regionPriority: ["us"],
      mediaTypes: ["mix"],
      onlyBetterMedia: true,
      maxAssetsPerType: 3,
      preferParentGames: false,
    } });

    vi.mocked(getScreenScraperStatus).mockResolvedValue({ enabled: true, diagnostics: {} });
    vi.mocked(getScreenScraperSettings).mockResolvedValue({
      defaults: baseSettings.defaults,
      user: {
        languagePriority: ["en", "es"],
        regionPriority: ["us"],
        mediaTypes: ["mix", "snap"],
        onlyBetterMedia: false,
        maxAssetsPerType: 4,
        preferParentGames: false,
      },
      effective: {
        languagePriority: ["en", "es"],
        regionPriority: ["us"],
        mediaTypes: ["mix", "snap"],
        onlyBetterMedia: false,
        maxAssetsPerType: 4,
        preferParentGames: false,
      },
    });

    render(
      <ScreenScraperAdminPageClient
        initialStatus={baseStatus}
        initialSettings={baseSettings}
        initialError={null}
      />,
    );

    await user.clear(screen.getByLabelText("Language priority"));
    await user.type(screen.getByLabelText("Language priority"), "en\nes");
    await user.clear(screen.getByLabelText("Region priority"));
    await user.type(screen.getByLabelText("Region priority"), "us\nca");
    await user.clear(screen.getByLabelText("Media type priority"));
    await user.type(screen.getByLabelText("Media type priority"), "mix\nsnap");
    await user.click(screen.getByLabelText("Only replace media when higher quality"));
    await user.clear(screen.getByLabelText("Max assets per type"));
    await user.type(screen.getByLabelText("Max assets per type"), "4");

    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(updateScreenScraperSettings).toHaveBeenCalledWith({
        languagePriority: ["en", "es"],
        regionPriority: ["us", "ca"],
        mediaTypes: ["mix", "snap"],
        onlyBetterMedia: false,
        maxAssetsPerType: 4,
      });
    });

    await waitFor(() => {
      expect(getScreenScraperStatus).toHaveBeenCalled();
      expect(getScreenScraperSettings).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Preferences updated/)).toBeInTheDocument();
  });

  it("shows an error notice when saving fails", async () => {
    const user = userEvent.setup();

    vi.mocked(updateScreenScraperSettings).mockRejectedValue(new ApiError("boom", 500));

    render(
      <ScreenScraperAdminPageClient
        initialStatus={baseStatus}
        initialSettings={baseSettings}
        initialError={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });

  it("validates overrides before queuing an enrichment job", async () => {
    const user = userEvent.setup();

    vi.mocked(enqueueScreenScraperEnrichment).mockResolvedValue({ job: { id: "123" } });

    render(
      <ScreenScraperAdminPageClient
        initialStatus={baseStatus}
        initialSettings={baseSettings}
        initialError={null}
      />,
    );

    await user.clear(screen.getByLabelText("Max assets per type"));
    await user.type(screen.getByLabelText("Max assets per type"), "not-a-number");
    await user.type(screen.getByLabelText("ROM identifier"), "rom-123");

    await user.click(screen.getByRole("button", { name: "Queue enrichment" }));

    expect(await screen.findByText(/Fix the highlighted fields/)).toBeInTheDocument();
    expect(enqueueScreenScraperEnrichment).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Max assets per type"));
    await user.type(screen.getByLabelText("Max assets per type"), "5");

    await user.click(screen.getByRole("button", { name: "Queue enrichment" }));

    await waitFor(() => {
      expect(enqueueScreenScraperEnrichment).toHaveBeenCalledWith("rom-123", {
        languagePriority: ["en", "fr"],
        regionPriority: ["us", "eu"],
        mediaTypes: ["mix", "wheel"],
        onlyBetterMedia: true,
        maxAssetsPerType: 5,
      });
    });

    expect(await screen.findByText(/Enrichment job queued/)).toBeInTheDocument();
  });
});
