import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RomDetail } from "@lib/api/roms";

vi.mock("@lib/api/roms", () => ({
  getRom: vi.fn()
}));

vi.mock("@/src/auth/session-provider", () => ({
  useSession: vi.fn()
}));

vi.mock("@/src/lib/api/admin/screenscraper", () => ({
  enqueueScreenScraperEnrichment: vi.fn()
}));

const baseSession = {
  accessToken: "token",
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn()
};

function createSession(role: string) {
  return {
    ...baseSession,
    user: {
      id: "user-1",
      email: "user@example.com",
      nickname: "Test User",
      role
    }
  };
}

const fullRomDetail: RomDetail = {
  id: "rom-1",
  title: "Chrono Trigger",
  platform: {
    id: "platform-1",
    name: "Super Nintendo",
    slug: "snes",
    shortName: "SNES"
  },
  releaseYear: 1995,
  players: 1,
  romSize: 4096,
  romHash: "hash-123",
  screenscraperId: 4242,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
  metadata: [
    {
      id: "meta-1",
      source: "ScreenScraper",
      language: "en",
      region: "US",
      summary: "A timeless RPG adventure.",
      developer: "Squaresoft",
      publisher: "Squaresoft",
      genre: "RPG",
      rating: 4.9,
      createdAt: "2024-01-02T12:00:00.000Z"
    },
    {
      id: "meta-0",
      source: "Manual entry",
      language: "en",
      region: null,
      summary: "Initial metadata seed.",
      developer: null,
      publisher: null,
      genre: null,
      rating: null,
      createdAt: "2023-12-20T09:00:00.000Z"
    }
  ],
  assets: [],
  binary: {
    id: "binary-1",
    storageKey: "roms/chrono-trigger.zip",
    originalFilename: "chrono-trigger.zip",
    archiveMimeType: "application/zip",
    archiveSize: 1024,
    checksumSha256: "sha256",
    checksumSha1: "sha1",
    checksumMd5: "md5",
    checksumCrc32: "crc32",
    status: "READY",
    uploadedAt: "2024-01-01T00:00:00.000Z"
  },
  enrichmentJobs: [
    {
      id: "job-1",
      provider: "SCREEN_SCRAPER",
      status: "COMPLETED",
      providerRomId: "1337",
      errorMessage: null,
      createdAt: "2024-01-02T13:00:00.000Z",
      updatedAt: "2024-01-02T14:00:00.000Z"
    }
  ],
  uploadAudits: [
    {
      id: "audit-1",
      status: "COMPLETED",
      kind: "UPLOAD",
      storageKey: "roms/chrono-trigger.zip",
      originalFilename: "chrono-trigger.zip",
      archiveMimeType: "application/zip",
      archiveSize: 1024,
      checksumSha256: "sha256",
      checksumSha1: "sha1",
      checksumMd5: "md5",
      checksumCrc32: "crc32",
      errorMessage: null,
      createdAt: "2024-01-02T15:00:00.000Z"
    }
  ]
};

describe("RomDetailSheet", () => {
  beforeEach(async () => {
    const { getRom } = await import("@lib/api/roms");
    const { useSession } = await import("@/src/auth/session-provider");
    vi.mocked(getRom).mockReset();
    vi.mocked(useSession).mockReturnValue(createSession("ADMIN"));
  });

  it("requests history and renders timeline for admins", async () => {
    const { getRom } = await import("@lib/api/roms");
    const { useSession } = await import("@/src/auth/session-provider");
    vi.mocked(useSession).mockReturnValue(createSession("ADMIN"));
    vi.mocked(getRom).mockResolvedValue(fullRomDetail);

    const { RomDetailSheet } = await import("../rom-detail-sheet");
    render(<RomDetailSheet id="rom-1" />);

    expect(await screen.findByText(/Metadata timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/ScreenScraper/i, { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Enrichment jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload audit log/i)).toBeInTheDocument();
    expect(screen.getAllByText(/chrono-trigger\.zip/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getRom).toHaveBeenCalledWith("rom-1", { includeHistory: true });
    });
  });

  it("omits history panels for non-admins", async () => {
    const { getRom } = await import("@lib/api/roms");
    const { useSession } = await import("@/src/auth/session-provider");
    vi.mocked(useSession).mockReturnValue(createSession("PLAYER"));
    vi.mocked(getRom).mockResolvedValue(fullRomDetail);

    const { RomDetailSheet } = await import("../rom-detail-sheet");
    render(<RomDetailSheet id="rom-1" />);

    expect(await screen.findByText(/ROM Detail/i)).toBeInTheDocument();
    expect(screen.queryByText(/Metadata timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Enrichment jobs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upload audit log/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getRom).toHaveBeenCalledWith("rom-1", {});
    });
  });

  it("renders empty states when history data is missing", async () => {
    const { getRom } = await import("@lib/api/roms");
    const { useSession } = await import("@/src/auth/session-provider");
    vi.mocked(useSession).mockReturnValue(createSession("ADMIN"));
    vi.mocked(getRom).mockResolvedValue({
      ...fullRomDetail,
      metadata: [],
      enrichmentJobs: [],
      uploadAudits: []
    });

    const { RomDetailSheet } = await import("../rom-detail-sheet");
    render(<RomDetailSheet id="rom-1" />);

    expect(await screen.findByText(/Metadata timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/No metadata history recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/No enrichment jobs run yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No upload activity recorded/i)).toBeInTheDocument();
  });
});
